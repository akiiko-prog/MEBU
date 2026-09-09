import { Platform } from 'react-native';
import { syncAbsencesNative } from '@/modules/android-widget-updater';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const IOS_APP_GROUP = 'group.fr.akiiko.mebu';

export interface WidgetAbsencesData {
    totalHours: number;       // total heures manquées
    unjustifiedHours: number; // heures injustifiées
    lastSubject: string;
}

export async function syncAbsencesToWidget(data: WidgetAbsencesData): Promise<void> {
    try {
        if (Platform.OS === 'android') {
            syncAbsencesNative(data.totalHours, data.unjustifiedHours, data.lastSubject);
            console.log('[DB] | [WidgetSync] Absences synced natively to Android widget:', data);
        } else {
            await SharedGroupPreferences.setItem(
                'absences',
                JSON.stringify(data),
                IOS_APP_GROUP
            );
        }
    } catch (error) {
        console.error('[DB] | [WidgetSync] Failed to sync absences to widget', error);
    }
}
