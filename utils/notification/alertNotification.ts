import * as Notifications from 'expo-notifications';

import { useSettingsStore } from '@/stores/settings';

function isEnabled(key: 'grade' | 'attendance' | 'cancel' | 'edit' | 'intracomEvents'): boolean {
    return useSettingsStore.getState().personalization[key] !== "off";
}

export async function sendNewGradeNotification(subject: string, score: string): Promise<void> {
    if (!isEnabled('grade')) return;
    const [grade, ...rest] = score.split('/');
    const parsed = parseFloat(grade.replace(',', '.'));
    const roundedScore = isNaN(parsed) ? score : [Math.round(parsed * 100) / 100, ...rest].join('/');

    await Notifications.scheduleNotificationAsync({
        content: {
            title: '🎓 Nouvelle note',
            body: `${subject} : ${roundedScore}`,
            sound: true,
            data: { type: 'new_grade' },
        },
        trigger: null,
    });
}

export async function sendNewIntracomEventNotification(newEventNumber: number): Promise<void> {
    if (!isEnabled('intracomEvents')) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: `📅 Nouve${newEventNumber > 1 ? 'aux' : 'l'} événement${newEventNumber > 1 ? 's' : ''} Intracom`,
            body: `${newEventNumber} nouveau${newEventNumber > 1 ? 'x' : ''} événement${newEventNumber > 1 ? 's' : ''} sont disponibles.`,
            sound: true,
            data: { type: 'new_intracom_event' },
        },
        trigger: null,
    });
}

export async function sendCancelCourseNotification(courseName: string): Promise<void> {
    if (!isEnabled('cancel')) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: '⛔ Annulation de cours',
            body: courseName,
            sound: true,
            data: { type: 'cancel_course' },
        },
        trigger: null,
    });
}

export async function sendEditCourseNotification(courseName: string): Promise<void> {
    if (!isEnabled('edit')) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: '✏️ Modification de cours',
            body: courseName,
            sound: true,
            data: { type: 'edit_course' },
        },
        trigger: null,
    });
}

export async function sendNewAbsenceNotification(): Promise<void> {
    if (!isEnabled('attendance')) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: '👻 Absence',
            body: 'Une nouvelle absence est disponible.',
            sound: true,
            data: { type: 'new_absence' },
        },
        trigger: null,
    });
}
