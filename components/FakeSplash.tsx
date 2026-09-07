import { useEffect, useState } from "react";
import ViewContainer from "@/ui/components/ViewContainer";
import Stack from "@/ui/components/Stack";
import React from "react";
import { Dimensions, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { Audio } from "expo-av";
import { useHotUpdaterStore } from "@hot-updater/react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const FakeSplash = ({ isAppReady }: { isAppReady: boolean }) => {
  const animation = React.useRef<LottieView>(null);
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  const translateX = useSharedValue(0);
  const otaProgress = useHotUpdaterStore((s) => s.progress);
  const otaDownloaded = useHotUpdaterStore((s) => s.isUpdateDownloaded);
  const otaActive = otaProgress > 0 && otaProgress < 1;
  const otaLabel = otaDownloaded
    ? "Mise à jour prête"
    : otaActive
      ? `Mise à jour ${Math.round(otaProgress * 100)}%`
      : null;

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    });
  }, []);

  useEffect(() => {
    if (!isAppReady) {
      animation.current?.play();
    }
  }, [isAppReady]);

  useEffect(() => {
    if (isAppReady && !dismissed) {
      translateX.value = withTiming(
        -SCREEN_WIDTH,
        { duration: 400, easing: Easing.in(Easing.cubic) },
        () => {
          runOnJS(setDismissed)(true);
        }
      );
    }
  }, [isAppReady, dismissed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (dismissed) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 999 }, animatedStyle]}>
      <ViewContainer>
        <Stack
          backgroundColor="#0060D6"
          gap={0}
          hAlign={"center"}
          vAlign={"center"}
          style={{
            width: "100%",
            flex: 1,
            borderCurve: "continuous",
            paddingTop: insets.top + 20,
            paddingBottom: 40,
          }}
        >
          <LottieView
            autoPlay={false}
            loop={false}
            ref={animation}
            style={{
              width: '100%',
              aspectRatio: 1,
              maxHeight: 200,
            }}
            resizeMode="contain"
            source={require("@/assets/lotties/theme.json")}
          />
          {otaLabel && (
            <Text style={styles.otaLabel}>{otaLabel}</Text>
          )}
        </Stack>
      </ViewContainer>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  otaLabel: {
    position: "absolute",
    bottom: 24,
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});

export default FakeSplash;
