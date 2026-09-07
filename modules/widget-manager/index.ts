import { requireNativeModule } from 'expo-modules-core';

const noop = { reloadAllTimelines: () => { } };

function tryRequire(): { reloadAllTimelines: () => void } {
    try {
        return requireNativeModule('WidgetManager') as { reloadAllTimelines: () => void };
    } catch {
        return noop;
    }
}

export default tryRequire();
