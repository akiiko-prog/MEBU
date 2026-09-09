
import 'react-native-reanimated';
import "@/utils/i18n";

import { Buffer } from 'buffer';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppProviders } from '@/components/AppProviders';
import FakeSplash from '@/components/FakeSplash';
import { RootNavigator } from '@/components/RootNavigator';
import { useAppInitialization } from '@/hooks/useAppInitialization';
import { useStartupSound } from '@/hooks/useStartupSound';

import { SplashScreen } from "expo-router";
import { useEffect, useState } from "react";

global.Buffer = Buffer;

function RootLayout() {
  const { isAppReady, fontsLoaded } = useAppInitialization();
  const { isSoundDone } = useStartupSound(isAppReady);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    if (!isAppReady || !isSoundDone) return;
    const timer = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(timer);
  }, [isAppReady, isSoundDone]);

  if (!fontsLoaded) return null;

  return (
    <AppProviders>
      <FakeSplash isAppReady={ready} />
      <RootNavigator isAppReady={ready} />
    </AppProviders>
  );
}

export default RootLayout;

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0060D6",
  },
  fallbackText: {
    marginTop: 16,
    fontSize: 16,
    color: "#ffffff",
  },
  fallbackProgress: {
    marginTop: 8,
    fontSize: 14,
    color: "#ffffff",
    opacity: 0.8,
  },
});