
import 'react-native-reanimated';
import "@/utils/i18n";

import { HotUpdater } from "@hot-updater/react-native";
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

export default HotUpdater.wrap({
  baseURL: "https://hot-updater.epimac.org/hot-updater",
  updateStrategy: "fingerprint",
  updateMode: "auto",
  requestTimeout: 5000,
  onError: (error) => {
    console.warn("[HotUpdater] error:", error);
  },
  onUpdateProcessCompleted: (info) => {
    console.log("[HotUpdater] update process completed:", JSON.stringify(info));
  },
  fallbackComponent: ({ progress, status }) => (
    <View style={styles.fallback}>
      {status === "UPDATING" && (
        <>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.fallbackText}>Mise à jour en cours...</Text>
          {progress > 0 && (
            <Text style={styles.fallbackProgress}>{Math.round(progress * 100)}%</Text>
          )}
        </>
      )}
    </View>
  ),
})(RootLayout);

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