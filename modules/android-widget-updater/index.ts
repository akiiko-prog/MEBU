import { Platform, NativeModules } from 'react-native';

/**
 * Accès au module natif AndroidWidgetUpdater.
 * Enregistré manuellement dans MainApplication.kt via AndroidWidgetUpdaterPackage.
 * On utilise NativeModules (React Native standard) et non requireNativeModule (Expo).
 */
function getModule() {
    if (Platform.OS !== 'android') return null;
    const mod = NativeModules.AndroidWidgetUpdater;
    if (!mod) {
        console.warn('[AndroidWidgetUpdater] Native module not found. Did you rebuild the app?');
    }
    return mod ?? null;
}

export function updateAllAndroidWidgets() {
    getModule()?.updateAllWidgets?.();
}

export function updateAbsencesAndroidWidget() {
    getModule()?.updateAllWidgets?.();
}

export function syncAbsencesNative(totalHours: number, unjustifiedHours: number, lastSubject: string) {
    getModule()?.syncAbsences?.(totalHours, unjustifiedHours, lastSubject);
}

export function syncTimetableNative(courseName: string, room: string, time: string, dateLabel: string) {
    getModule()?.syncTimetable?.(courseName, room, time, dateLabel);
}

export function syncGradesNative(averageStr: string, gradesJson: string) {
    getModule()?.syncGrades?.(averageStr, gradesJson);
}
