import { Papicons } from '@getpapillon/papicons'
import { useFocusEffect, useTheme } from '@react-navigation/native'
import { LiquidGlassContainer } from '@sbaiahmed1/react-native-blur';
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, View } from 'react-native'
import { useBottomTabBarHeight } from 'react-native-bottom-tabs'
import { RefreshControl } from 'react-native-gesture-handler'
import Reanimated, { LayoutAnimationConfig, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import News from '@/database/models/News'
import { cleanupOldIntracomEvents, fetchIntracomBonus, getIntracomEventsFromCache, getRegisteredIntracomEventsFromCache, saveIntracomEventsToDatabase, saveRegisteredIntracomEvents } from '@/database/useIntracomEvents'
import { useNews } from '@/database/useNews'
import { getManager, subscribeManagerUpdate } from '@/services/shared'
import { useAccountStore } from '@/stores/account'
import AnimatedPressable from '@/ui/components/AnimatedPressable'
import Avatar from '@/ui/components/Avatar'
import { Dynamic } from '@/ui/components/Dynamic'
import Icon from '@/ui/components/Icon'
import Item, { Leading } from '@/ui/components/Item'
import Search from '@/ui/components/Search'
import Stack from '@/ui/components/Stack'
import TabHeader from '@/ui/components/TabHeader'
import TabHeaderTitle from '@/ui/components/TabHeaderTitle'
import Typography from '@/ui/components/Typography'
import { useKeyboardHeight } from '@/ui/hooks/useKeyboardHeight'
import { PapillonAppearIn, PapillonAppearOut } from '@/ui/utils/Transition'
import { getProfileColorByName } from '@/utils/chats/colors'
import { getInitials } from '@/utils/chats/initials'
import { getIntracomRequestHeaders, getValidIntracomToken } from '@/utils/intracomAuth'
import { warn } from '@/utils/logger/logger'

import IntracomBonusWidget from './components/IntracomBonusWidget'
import IntracomCard from './components/IntracomCard'
import { loginIntracomPure } from '@/utils/intracomAuthWorker';
import { Services } from '@/stores/account/types';
import { getCredentials } from '@/utils/credentialStore';
import { useAlert } from '@/ui/components/AlertProvider';
import { set } from 'date-fns';

interface IntracomEvent {
  id: number;
  date: string;
  type: string;
  name: string;
  campusSlug: string;
  registeredStudents: number;
  nbNewStudents: number;
  maxStudents: number;
  state: "OPEN" | "CLOSED";
  address?: string;
  zipcode?: string;
  town?: string;
  latitude?: number;
  longitude?: number;
  slotTimes?: string;
  participants?: string;
  bonus?: number;
}

const INTRACOM_EVENTS_URL = "https://intracom.epita.fr/api/Students/Events?EventType=[]&Restrict=true&Research=&PageSize=20&PageNumber=1";




const NewsView = () => {

  const { t } = useTranslation();

  const onPress = () => {
    router.push("/(modals)/news");
  };

  const theme = useTheme()
  const colors = theme.colors
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const alert = useAlert();

  const [headerHeight, setHeaderHeight] = useState(0)
  const bottomTabBarHeight = useBottomTabBarHeight();

  const [isLoading, setIsLoading] = useState(false)
  const [isManuallyLoading, setIsManuallyLoading] = useState(false)

  const keyboardHeight = useKeyboardHeight();

  const footerStyle = useAnimatedStyle(() => ({
    height: keyboardHeight.value - bottomTabBarHeight,
  }));

  const news = useNews();
  const lastUsedAccount = useAccountStore((s) => s.lastUsedAccount);

  const [intracomEvents, setIntracomEvents] = useState<IntracomEvent[]>([]);
  const [registeredIntracomEvents, setRegisteredIntracomEvents] = useState<IntracomEvent[]>([]);

  const [intracomLoading, setIntracomLoading] = useState(false);

  const fetchIntracomEvents = useCallback(async () => {
    const token = await getValidIntracomToken();
    const accountId = lastUsedAccount || 'default';

    const cachedEvents = await getIntracomEventsFromCache(accountId);
    if (cachedEvents.length > 0) {
      setIntracomEvents(cachedEvents);
    }

    const cachedRegistered = await getRegisteredIntracomEventsFromCache(accountId);
    if (cachedRegistered.length > 0) {
      setRegisteredIntracomEvents(cachedRegistered);
    }



    try {
      setIntracomLoading(true);
      const headers = await getIntracomRequestHeaders(token);

      const hasAuth = headers["Authorization"] !== undefined || headers["Cookie"] !== undefined;

      if (!hasAuth) {
        warn("[Intracom] No authentication available (no token, no cookies). Skipping sync.");
        return;
      }

      const response = await fetch(INTRACOM_EVENTS_URL, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const events: IntracomEvent[] = data.elemPage || [];

      const eventsWithDetails = await Promise.all(
        events.map(async (event) => {
          let updatedEvent = { ...event };

          try {
            const detailsRes = await fetch(`https://intracom.epita.fr/api/Events/${event.id}`, {
              headers: headers,
            });

            if (detailsRes.ok) {
              const details = await detailsRes.json();
              updatedEvent = {
                ...updatedEvent,
                address: details.address,
                zipcode: details.zipcode,
                town: details.town,
                latitude: details.latitude,
                longitude: details.longitude,
              };
            }

            const slotsRes = await fetch(`https://intracom.epita.fr/api/Events/${event.id}/SlotInfos`, {
              headers: headers,
            });

            if (slotsRes.ok) {
              const slots: any[] = await slotsRes.json();
              const allParticipants: any[] = [];
              let firstStart: string | null = null;
              let lastEnd: string | null = null;

              slots.forEach((slotInfo) => {
                slotInfo.jobs?.forEach((job: any) => {
                  job.slots?.forEach((slot: any) => {
                    if (!firstStart || slot.startTime < firstStart) {
                      firstStart = slot.startTime;
                    }
                    if (!lastEnd || slot.endTime > lastEnd) {
                      lastEnd = slot.endTime;
                    }
                    slot.groups?.forEach((group: any) => {
                      group.participants?.forEach((participant: any) => {
                        if (!allParticipants.find(p => p.id === participant.id)) {
                          allParticipants.push(participant);
                        }
                      });
                    });
                  });
                });
              });

              if (allParticipants.length > 0) {
                updatedEvent.participants = JSON.stringify(allParticipants);
              }
              if (firstStart && lastEnd) {
                updatedEvent.slotTimes = JSON.stringify({ start: firstStart, end: lastEnd });
              }
            }

          } catch {
          }
          return updatedEvent;
        })
      );

      setIntracomEvents(eventsWithDetails);

      if (eventsWithDetails.length > 0) {
        await saveIntracomEventsToDatabase(eventsWithDetails, accountId);
        await cleanupOldIntracomEvents(accountId);
      }

      if (hasAuth) {
        await fetchIntracomBonus(token);
        const registeredRes = await fetch(`https://intracom.epita.fr/api/Students/RegisteredEvents?EventType=[]&Research=&PageSize=20&PageNumber=1`, {
          headers: headers,
        });

        if (registeredRes.ok) {
          const registeredData = await registeredRes.json();
          const registeredEvents: IntracomEvent[] = registeredData.elemPage || [];

          const openRegisteredEvents = registeredEvents.filter(e => e.state === 'OPEN');

          const registeredEventsWithDetails = await Promise.all(
            openRegisteredEvents.map(async (event) => {
              let updatedEvent = { ...event };
              try {
                const detailsRes = await fetch(`https://intracom.epita.fr/api/Events/${event.id}`, {
                  headers: headers,
                });
                if (detailsRes.ok) {
                  const d = await detailsRes.json();
                  updatedEvent = { ...updatedEvent, address: d.address, zipcode: d.zipcode, town: d.town, latitude: d.latitude, longitude: d.longitude };
                }

                const slotsRes = await fetch(`https://intracom.epita.fr/api/Events/${event.id}/SlotInfos`, {
                  headers: headers,
                });
                if (slotsRes.ok) {
                  const s = await slotsRes.json();
                  const allParticipants: any[] = [];
                  let firstStart: string | null = null;
                  let lastEnd: string | null = null;
                  s.forEach((slotInfo: any) => {
                    slotInfo.jobs?.forEach((job: any) => {
                      job.slots?.forEach((slot: any) => {
                        if (!firstStart || slot.startTime < firstStart) { firstStart = slot.startTime; }
                        if (!lastEnd || slot.endTime > lastEnd) { lastEnd = slot.endTime; }
                        slot.groups?.forEach((group: any) => {
                          group.participants?.forEach((participant: any) => {
                            if (!allParticipants.find(p => p.id === participant.id)) { allParticipants.push(participant); }
                          });
                        });
                      });
                    });
                  });
                  if (allParticipants.length > 0) { updatedEvent.participants = JSON.stringify(allParticipants); }
                  if (firstStart && lastEnd) { updatedEvent.slotTimes = JSON.stringify({ start: firstStart, end: lastEnd }); }
                }
              } catch { }
              return updatedEvent;
            })
          );

          setRegisteredIntracomEvents(registeredEventsWithDetails);
          await saveRegisteredIntracomEvents(registeredEventsWithDetails, accountId);
        }
      }



    } catch (error) {
      warn(`[Intracom] Erreur lors de la sync: ${error}`);
    } finally {
      setIntracomLoading(false);
    }
  }, [lastUsedAccount]);

  useEffect(() => {
    fetchIntracomEvents();
  }, [fetchIntracomEvents]);

  useFocusEffect(
    useCallback(() => {
      fetchIntracomEvents();
    }, [fetchIntracomEvents])
  );
  const sortedNews = useMemo(() => {
    return news.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [news]);

  const fetchNews = useCallback(() => {
    try {
      setIsLoading(true)
      const manager = getManager();
      if (!manager) {
        warn("Manager is null, skipping news fetch");
        return;
      }
      manager.getNews();
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setIsLoading(false)
      setIsManuallyLoading(false)
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeManagerUpdate((_) => {
      fetchNews();
    });

    return () => unsubscribe();
  }, []);

  const [searchText, setSearchText] = useState('');

  const filteredNews = useMemo(() => {
    if (!searchText.trim()) {
      return sortedNews;
    }

    const searchLower = searchText.toLowerCase();

    const results = sortedNews.filter((newsItem) => {
      const title = newsItem.title?.toLowerCase() || '';
      const content = newsItem.content?.toLowerCase() || '';
      const author = newsItem.author?.toLowerCase() || '';
      const category = newsItem.category?.toLowerCase() || '';

      const d = new Date(newsItem.createdAt);
      const date = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;

      return (
        title.includes(searchLower) ||
        content.includes(searchLower) ||
        author.includes(searchLower) ||
        category.includes(searchLower) ||
        date.includes(searchLower)
      );
    });

    return results;
  }, [sortedNews, searchText]);

  const filteredRegisteredIntracomEvents = useMemo(() => {
    if (!searchText.trim()) return registeredIntracomEvents;
    const searchLower = searchText.toLowerCase();
    return registeredIntracomEvents.filter((event) => {
      const name = event.name?.toLowerCase() || '';
      const type = event.type?.toLowerCase() || '';

      let date = '';
      if (event.date) {
        const d = new Date(event.date);
        date = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
      }

      return name.includes(searchLower) || type.includes(searchLower) || date.includes(searchLower);
    });
  }, [registeredIntracomEvents, searchText]);

  const filteredIntracomEvents = useMemo(() => {
    const openEvents = intracomEvents.filter((event) => event.state === "OPEN");
    if (!searchText.trim()) return openEvents;

    const searchLower = searchText.toLowerCase();
    return openEvents.filter((event) => {
      const name = event.name?.toLowerCase() || '';
      const type = event.type?.toLowerCase() || '';

      let date = '';
      if (event.date) {
        const d = new Date(event.date);
        date = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
      }

      return name.includes(searchLower) || type.includes(searchLower) || date.includes(searchLower);
    });
  }, [intracomEvents, searchText]);

  useEffect(() => {
    if (searchText.trim()) {
      const total = filteredNews.length + filteredRegisteredIntracomEvents.length + filteredIntracomEvents.length;
      console.log(`[Search] "${searchText}" -> ${total} résultats trouvés (News: ${filteredNews.length}, Inscrits: ${filteredRegisteredIntracomEvents.length}, Events: ${filteredIntracomEvents.length})`);
    }
  }, [searchText, filteredNews, filteredRegisteredIntracomEvents, filteredIntracomEvents]);

  return (
    <>
      <TabHeader
        onHeightChanged={setHeaderHeight}
        title={
          <TabHeaderTitle
            color={colors.primary}
            leading={t("Tab_News")}
            chevron={false}
            loading={isLoading}
          />
        }
        trailing={
          <LiquidGlassContainer>
            <AnimatedPressable onPressIn={onPress}>
              <Stack
                card
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 30,
                }}
                hAlign='center'
                vAlign='center'
                noShadow
              >
                <Icon size={26} fill={colors.text}>
                  <Papicons name="newspaper" />
                </Icon>
              </Stack>
            </AnimatedPressable>
          </LiquidGlassContainer>

        }
        bottom={
          <View style={{ gap: 10, width: '100%', paddingHorizontal: 16 }}>
            <Search placeholder={t('News_Search_Placeholder')} color='#2B7ED6' onTextChange={(text) => setSearchText(text)} />
          </View>
        }
      />
      <LayoutAnimationConfig skipEntering>
        <FlatList
          contentContainerStyle={{
            paddingBottom: insets.bottom + bottomTabBarHeight,
            paddingHorizontal: 16,
            gap: 9,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isManuallyLoading}
              onRefresh={async () => {
                setIsManuallyLoading(true);
                try {
                  const { username, password } = await getCredentials(Services.INTRACOM) || { username: '', password: '' };
                  const token = await loginIntracomPure(username, password);
                  console.log("Token for manual refresh:", token);
                  await fetchNews();
                  await fetchIntracomEvents();
                  if (token) { await fetchIntracomBonus(token); }
                } catch (error) {
                  setIsManuallyLoading(false);
                  alert.showAlert({
                    title: t("Attendance_Login_Error_Title"),
                    description: t("Attendance_Login_Error_InvalidCredentials"),
                    icon: "AlertCircle",
                    color: "#D60000"
                  });
                }
              }}
              progressViewOffset={headerHeight}
            />
          }
          data={filteredNews}
          keyExtractor={(item) => item.id}
          ListFooterComponent={<Reanimated.View style={footerStyle} />}
          renderItem={({ item }) => <NewsItem item={item} />}
          scrollIndicatorInsets={{ top: headerHeight - insets.top }}
          ListHeaderComponent={
            <View style={{ paddingTop: headerHeight, gap: 16 }}>
              {!searchText && <IntracomBonusWidget />}

              {filteredRegisteredIntracomEvents.length > 0 && (
                <View style={{ marginBottom: 0 }}>
                  <Typography variant="h5" style={{ marginBottom: 10, color: colors.text }}>
                    Inscrits
                  </Typography>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {filteredRegisteredIntracomEvents.map((event) => (
                      <IntracomCard key={`reg-${event.id}`} event={event} hideRegisterButton />
                    ))}
                  </ScrollView>

                </View>
              )}

              {filteredIntracomEvents.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Typography variant="h5" style={{ marginBottom: 10, color: colors.text }}>
                    Événements Intracom
                  </Typography>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {filteredIntracomEvents.map((event) => (
                      <IntracomCard key={event.id} event={event} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            (filteredNews.length === 0 && filteredIntracomEvents.length === 0 && filteredRegisteredIntracomEvents.length === 0) ? (
              <Dynamic animated key={'empty-list:warn'} entering={PapillonAppearIn} exiting={PapillonAppearOut}>
                <Stack
                  hAlign="center"
                  vAlign="center"
                  flex
                  style={{ width: "100%", marginTop: 16 }}
                >
                  <Icon opacity={0.5} size={32} style={{ marginBottom: 3 }}>
                    <Papicons name={searchText ? "Search" : "Newspaper"} />
                  </Icon>
                  <Typography variant="h4" color="text" align="center">
                    {searchText ? t('News_Search_NoResults') : t('News_Empty_Title')}
                  </Typography>
                  <Typography variant="body2" color="secondary" align="center">
                    {searchText ? t('News_Search_NoResults_Description') : t('News_Empty_Description')}
                  </Typography>
                </Stack>
              </Dynamic>
            ) : null
          }
        />
      </LayoutAnimationConfig>
    </>
  )
}

const NewsItem = ({ item }: { item: any }) => {
  const router = useRouter()

  const profileColor = useMemo(() => getProfileColorByName(item.author), [item.author]);
  const profileInitials = useMemo(() => getInitials(item.author), [item.author]);

  return (
    <AnimatedPressable
      onPress={() => router.push({
        pathname: "/(modals)/news",
        params: { news: JSON.stringify(item) },
      })}
    >
      <Stack card>
        <Item isLast>
          <Leading>
            <Avatar
              size={40}
              color={profileColor}
              initials={profileInitials}
            />
          </Leading>

          <Typography variant='title' numberOfLines={2}>
            {item.title}
          </Typography>
          <Typography variant='body1' color='secondary' numberOfLines={3}>
            {item.content ? truncateString(cleanContent(item.content), 100) : ""}
          </Typography>


          <Stack
            direction='horizontal'
            gap={4}
            style={{ marginTop: 4 }}
            hAlign='center'
          >
            <Typography nowrap weight='medium' style={{ flex: 1 }} variant='caption' color='secondary'>
              {item.author}
            </Typography>

            <Typography nowrap weight='medium' variant='caption' color='secondary'>
              {new Date(item.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </Typography>

            {item.attachments.length > 0 && (
              <Icon size={18} opacity={0.4}>
                <Papicons name={"link"} />
              </Icon>
            )}
          </Stack>
        </Item>
      </Stack>
    </AnimatedPressable>
  )
}

function cleanContent(html: string): string {
  html = html.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  html = html.replace(/\n/g, " ");
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + "...";
}

export default NewsView