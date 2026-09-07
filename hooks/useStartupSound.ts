import { Audio } from "expo-av";
import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "@/stores/settings";

let hasPlayedGlobal = false;

export function useStartupSound(isAppReady: boolean) {
    const soundRef = useRef<Audio.Sound | null>(null);
    const [isSoundDone, setIsSoundDone] = useState(false);
    const UserPreference = useSettingsStore(state => state.personalization.sound);

    useEffect(() => {
        if (UserPreference === "off" || hasPlayedGlobal) {
            setIsSoundDone(true);
            return;
        }
        hasPlayedGlobal = true;

        let unmounted = false;

        async function playSound() {
            try {
                await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

                const { sound } = await Audio.Sound.createAsync(
                    require("@/assets/sounds/openSound.mp3")
                );
                soundRef.current = sound;

                if (unmounted) {
                    await sound.unloadAsync();
                    return;
                }

                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        setIsSoundDone(true);
                    }
                });

                await sound.playAsync();
            } catch (e) {
                console.warn("[useStartupSound] Impossible to play startup sound:", e);
                setIsSoundDone(true);
            }
        }

        playSound();

        return () => {
            unmounted = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [UserPreference]);

    // Unload sound only when component fully unmounts
    useEffect(() => {
        return () => {
            soundRef.current?.unloadAsync().catch(() => { });
        };
    }, []);

    return { isSoundDone };
}
