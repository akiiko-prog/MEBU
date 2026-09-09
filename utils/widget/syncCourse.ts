import { Platform } from 'react-native';
import { syncTimetableNative } from '@/modules/android-widget-updater';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const IOS_APP_GROUP = 'group.fr.akiiko.mebu';

export interface WidgetTimetableData {
    nextCourseName: string;
    nextCourseRoom: string;
    nextCourseTime: string;
    coursesCount: number;
}

export async function syncNextCourseToWidget(
    courseName: string,
    room: string,
    time: string = '',
    dateLabel: string = ''
) {
    try {
        if (Platform.OS === 'android') {
            syncTimetableNative(courseName, room, time, dateLabel);
            console.log('[DB] | [WidgetSync] Timetable synced natively:', { courseName, room, time, dateLabel });
        } else {
            await SharedGroupPreferences.setItem('nextCourseName', courseName, IOS_APP_GROUP);
            await SharedGroupPreferences.setItem('nextCourseRoom', room, IOS_APP_GROUP);
        }
    } catch (error) {
        console.error('[DB] | [WidgetSync] Failed to sync timetable to widget', error);
    }
}
