import { Papicons } from '@getpapillon/papicons'
import { useFocusEffect, useTheme } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native'
import { useBottomTabBarHeight } from 'react-native-bottom-tabs'
import { RefreshControl } from 'react-native-gesture-handler'
import { LayoutAnimationConfig } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { fetchEvents, deleteEvent, SchoolEvent } from '@/services/events';
import { canCreateEvent } from '@/utils/permission/eventPermissions';
import { getCredentials } from '@/utils/credentialStore';
import { Services } from '@/stores/account/types';
import AnimatedPressable from '@/ui/components/AnimatedPressable'
import { Dynamic } from '@/ui/components/Dynamic'
import Icon from '@/ui/components/Icon'
import Search from '@/ui/components/Search'
import Stack from '@/ui/components/Stack'
import TabHeader from '@/ui/components/TabHeader'
import TabHeaderTitle from '@/ui/components/TabHeaderTitle'
import Typography from '@/ui/components/Typography'
import { PapillonAppearIn, PapillonAppearOut } from '@/ui/utils/Transition'
import { useAlert } from '@/ui/components/AlertProvider';

import EventCard from './components/EventCard';

const NewsView = () => {
  const { t } = useTranslation();
  const theme = useTheme()
  const colors = theme.colors
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const alert = useAlert();

  const [headerHeight, setHeaderHeight] = useState(0)
  const bottomTabBarHeight = useBottomTabBarHeight();

  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isManuallyLoading, setIsManuallyLoading] = useState(false);
  const [currentLogin, setCurrentLogin] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    getCredentials(Services.AURIGA).then((creds) => {
      if (creds?.username) setCurrentLogin(creds.username);
    });
  }, []);

  const canEdit = useMemo(() => canCreateEvent(currentLogin), [currentLogin]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchEvents();
    setEvents(data);
    setIsLoading(false);
    setIsManuallyLoading(false);
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const filteredEvents = useMemo(() => {
    if (!searchText.trim()) return events;
    const q = searchText.toLowerCase();
    return events.filter((e) =>
      e.title.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q)
    );
  }, [events, searchText]);

  const handleDelete = useCallback((id: string) => {
    alert.showAlert({
      title: "Supprimer l'événement ?",
      description: "Cette action est irréversible.",
      icon: "Trash",
      color: "#D60000",
      // @ts-ignore - selon le composant AlertProvider, adapte si besoin de boutons de confirmation
    });
    deleteEvent(id).then(() => loadEvents());
  }, [loadEvents, alert]);

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
          canEdit ? (
            <AnimatedPressable onPress={() => router.push("/(modals)/create-event")}>
              <Stack
                card
                style={{ width: 42, height: 42, borderRadius: 30 }}
                hAlign='center'
                vAlign='center'
                noShadow
              >
                <Icon size={26} fill={colors.text}>
                  <Papicons name="Plus" />
                </Icon>
              </Stack>
            </AnimatedPressable>
          ) : undefined
        }
        bottom={
          <View style={{ gap: 10, width: '100%', paddingHorizontal: 16 }}>
            <Search placeholder={t('News_Search_Placeholder')} color='#2B7ED6' onTextChange={setSearchText} />
          </View>
        }
      />
      <LayoutAnimationConfig skipEntering>
        <FlatList
          contentContainerStyle={{
            paddingBottom: insets.bottom + bottomTabBarHeight,
            paddingHorizontal: 16,
            paddingTop: headerHeight,
            gap: 10,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isManuallyLoading}
              onRefresh={() => { setIsManuallyLoading(true); loadEvents(); }}
              progressViewOffset={headerHeight}
            />
          }
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              canEdit={canEdit}
              onEdit={() => router.push({ pathname: "/(modals)/create-event", params: { id: item.id } })}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          ListEmptyComponent={
            <Dynamic animated key={'empty-list:warn'} entering={PapillonAppearIn} exiting={PapillonAppearOut}>
              <Stack hAlign="center" vAlign="center" flex style={{ width: "100%", marginTop: 16 }}>
                <Icon opacity={0.5} size={32} style={{ marginBottom: 3 }}>
                  <Papicons name={searchText ? "Search" : "Newspaper"} />
                </Icon>
                <Typography variant="h4" color="text" align="center">
                  {searchText ? t('News_Search_NoResults') : "Aucun événement pour le moment"}
                </Typography>
              </Stack>
            </Dynamic>
          }
        />
      </LayoutAnimationConfig>
    </>
  )
}

export default NewsView