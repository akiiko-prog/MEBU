import { Platform } from 'react-native';
import { syncGradesNative } from '@/modules/android-widget-updater';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const IOS_APP_GROUP = 'group.fr.akiiko.mebu';
const IOS_GRADES_KEY = 'mebuGrades';

export interface WidgetGrade {
    subject: string;
    value: number;
    outOf: number;
    date: string;
}

export interface WidgetGradesData {
    average: number;
    latestGrades: WidgetGrade[];
    averageHistory: { date: string; avg: number }[];
}

export async function syncGradesToWidget(data: WidgetGradesData) {
    try {
        const topGrades = data.latestGrades.slice(0, 5);
        const averageStr = data.average > 0 ? data.average.toFixed(2) : '—';

        if (Platform.OS === 'android') {
            const gradesJson = JSON.stringify(
                topGrades.map(g => ({
                    subject: g.subject,
                    value: `${Math.round(g.value * 10) / 10}/${g.outOf}`,
                    date: g.date ? new Date(g.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '',
                }))
            );
            syncGradesNative(averageStr, gradesJson);
            console.log('[GradesWidget] Grades synced natively. Average:', averageStr);
        } else {
            const payload = {
                average: data.average,
                latestGrades: topGrades,
                averageHistory: data.averageHistory.slice(-20),
            };
            await SharedGroupPreferences.setItem(IOS_GRADES_KEY, JSON.stringify(payload), IOS_APP_GROUP);

            try {
                const WidgetManager = require('@/modules/widget-manager').default;
                WidgetManager.reloadAllTimelines?.();
            } catch { }
        }
    } catch (error) {
        console.error('[GradesWidget] Failed to sync grades data to widget', error);
    }
}
