import { Papicons } from '@getpapillon/papicons';
import { LegendList } from '@legendapp/list';
import { useRouter } from 'expo-router';
import { t } from 'i18next';
import React, { useCallback, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { BottomTabBarHeightContext } from 'react-native-bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccountStore } from '@/stores/account';

import HomeHeader from './atoms/HomeHeader';
import HomeTopBar from './atoms/HomeTopBar';
import Wallpaper from './atoms/Wallpaper';
import HomeWidget, { HomeWidgetItem } from './components/HomeWidget';
import { useHomeData } from './hooks/useHomeData';
import HomeIntracomWidget from './widgets/intracom';
import HomeTimeTableWidget from './widgets/timetable';
import HomeLinksWidget from './widgets/links';

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;

  const accounts = useAccountStore((state) => state.accounts);
  const router = useRouter();

  useHomeData();

  const renderTimeTable = useCallback(() => <HomeTimeTableWidget />, []);
  const renderIntracom = useCallback(() => <HomeIntracomWidget />, []);
  const renderLinks = useCallback(() => <HomeLinksWidget />, []);

  const data: HomeWidgetItem[] = useMemo(() => [
    {
      icon: <Papicons name={"Calendar"} />,
      title: t("Home_Widget_NextCourses"),
      redirect: "(tabs)/calendar",
      render: renderTimeTable
    },
    {
      icon: <Papicons name={"newspaper"} />,
      title: t("Home_Widget_NextEvent"),
      redirect: "(tabs)/news",
      render: renderIntracom
    },
    {
      icon: <Papicons name={"link"} />,
      title: t("Home_Widget_UsefulLinks"),
      redirect: "(modals)/linksList",
      render: renderLinks
    },
  ], [renderTimeTable, renderIntracom, renderLinks]);

  useEffect(() => {
    if (accounts.length === 0) {
      router.replace("/(onboarding)/welcome");
    }
  }, [accounts.length, router]);

  if (accounts.length === 0) {
    return null;
  }

  return (
    <>
      <Wallpaper />
      <HomeTopBar />
      <LegendList
        renderItem={({ item }) => <HomeWidget item={item} />}
        keyExtractor={(item) => item.title}
        ListHeaderComponent={<HomeHeader />}
        style={{ flex: 1 }}
        ItemSeparatorComponent={() => <React.Fragment><View style={{ height: 16 }} /></React.Fragment>}
        contentContainerStyle={{
          paddingBottom: insets.bottom + bottomTabBarHeight,
          paddingHorizontal: 16,
        }}
        data={data}
      />
    </>
  );
};

export default HomeScreen;
