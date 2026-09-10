import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTheme } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, TextInput as RNTextInput, View } from 'react-native';

import { createEvent, fetchEvents, updateEvent } from '@/services/events';
import { Services } from '@/stores/account/types';
import { useAlert } from '@/ui/components/AlertProvider';
import AnimatedPressable from '@/ui/components/AnimatedPressable';
import Stack from '@/ui/components/Stack';
import Typography from '@/ui/components/Typography';
import { getCredentials } from '@/utils/credentialStore';

export default function CreateEventScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id?: string }>();
    const alert = useAlert();
    const theme = useTheme();
    const colors = theme.colors;
    const isEditing = !!id;

    const [title, setTitle] = useState('');
    const [timeStart, setTimeStart] = useState(new Date());
    const [timeEnd, setTimeEnd] = useState(new Date(Date.now() + 60 * 60 * 1000));
    const [description, setDescription] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [saving, setSaving] = useState(false);

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    useEffect(() => {
        if (isEditing) {
            fetchEvents().then((events) => {
                const existing = events.find((e) => e.id === id);
                if (existing) {
                    setTitle(existing.title);
                    setTimeStart(new Date(existing.time_start));
                    setTimeEnd(new Date(existing.time_end));
                    setDescription(existing.description ?? '');
                    setLinkUrl(existing.link_url ?? '');
                }
            });
        }
    }, [id]);

    const handleSave = async () => {
        if (!title.trim()) {
            alert.showAlert({
                title: "Champ manquant",
                description: "Le titre est obligatoire.",
                icon: "AlertCircle",
                color: "#D60000"
            });
            return;
        }

        setSaving(true);
        const { username } = await getCredentials(Services.AURIGA) || { username: 'inconnu' };

        const payload = {
            title: title.trim(),
            time_start: timeStart.toISOString(),
            time_end: timeEnd.toISOString(),
            description: description.trim() || null,
            link_url: linkUrl.trim() || null,
            created_by: username || 'inconnu',
        };

        const success = isEditing
            ? await updateEvent(id!, payload)
            : await createEvent(payload);

        setSaving(false);

        if (success) {
            router.back();
        } else {
            alert.showAlert({
                title: "Erreur",
                description: "Impossible d'enregistrer l'événement.",
                icon: "AlertCircle",
                color: "#D60000"
            });
        }
    };

    const openAndroidPicker = (
        currentValue: Date,
        onFinalChange: (date: Date) => void
    ) => {
        DateTimePickerAndroid.open({
            value: currentValue,
            mode: 'date',
            onChange: (_, selectedDate) => {
                if (!selectedDate) return;
                DateTimePickerAndroid.open({
                    value: selectedDate,
                    mode: 'time',
                    onChange: (_, selectedTime) => {
                        if (selectedTime) onFinalChange(selectedTime);
                    },
                });
            },
        });
    };

    const inputStyle = {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: colors.text,
        backgroundColor: colors.card,
    };

    const formatDateTime = (d: Date) =>
        d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' }) +
        ' à ' +
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Typography variant="h4">{isEditing ? "Modifier l'événement" : "Créer un événement"}</Typography>

            <View>
                <Typography variant="caption" color="secondary" style={{ marginBottom: 4 }}>Titre</Typography>
                <RNTextInput
                    style={inputStyle}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Titre de l'événement"
                    placeholderTextColor={colors.text + '80'}
                />
            </View>

            <View>
                <Typography variant="caption" color="secondary" style={{ marginBottom: 4 }}>Début</Typography>
                <AnimatedPressable onPress={() => {
                    if (Platform.OS === 'android') {
                        openAndroidPicker(timeStart, setTimeStart);
                    } else {
                        setShowStartPicker(true);
                    }
                }}>
                    <View style={inputStyle}>
                        <Typography style={{ color: colors.text }}>{formatDateTime(timeStart)}</Typography>
                    </View>
                </AnimatedPressable>
                {Platform.OS === 'ios' && showStartPicker && (
                    <DateTimePicker
                        value={timeStart}
                        mode="datetime"
                        display="spinner"
                        onChange={(_, selectedDate) => {
                            setShowStartPicker(false);
                            if (selectedDate) setTimeStart(selectedDate);
                        }}
                    />
                )}
            </View>

            <View>
                <Typography variant="caption" color="secondary" style={{ marginBottom: 4 }}>Fin</Typography>
                <AnimatedPressable onPress={() => {
                    if (Platform.OS === 'android') {
                        openAndroidPicker(timeEnd, setTimeEnd);
                    } else {
                        setShowEndPicker(true);
                    }
                }}>
                    <View style={inputStyle}>
                        <Typography style={{ color: colors.text }}>{formatDateTime(timeEnd)}</Typography>
                    </View>
                </AnimatedPressable>
                {Platform.OS === 'ios' && showEndPicker && (
                    <DateTimePicker
                        value={timeEnd}
                        mode="datetime"
                        display="spinner"
                        onChange={(_, selectedDate) => {
                            setShowEndPicker(false);
                            if (selectedDate) setTimeEnd(selectedDate);
                        }}
                    />
                )}
            </View>

            <View>
                <Typography variant="caption" color="secondary" style={{ marginBottom: 4 }}>Description</Typography>
                <RNTextInput
                    style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Détails de l'événement"
                    placeholderTextColor={colors.text + '80'}
                    multiline
                />
            </View>

            <View>
                <Typography variant="caption" color="secondary" style={{ marginBottom: 4 }}>Lien (optionnel)</Typography>
                <RNTextInput
                    style={inputStyle}
                    value={linkUrl}
                    onChangeText={setLinkUrl}
                    placeholder="https://..."
                    placeholderTextColor={colors.text + '80'}
                    autoCapitalize="none"
                />
            </View>

            <AnimatedPressable onPress={handleSave}>
                <Stack card hAlign="center" vAlign="center" style={{ padding: 14, backgroundColor: '#0060D6' }}>
                    <Typography variant="body1" style={{ color: 'white', fontWeight: '600' }}>
                        {saving ? "Enregistrement..." : isEditing ? "Modifier" : "Créer"}
                    </Typography>
                </Stack>
            </AnimatedPressable>
        </ScrollView>
    );
}