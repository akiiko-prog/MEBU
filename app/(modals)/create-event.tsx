import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, View, TextInput as RNTextInput } from 'react-native';

import { createEvent, updateEvent, fetchEvents } from '@/services/events';
import { getCredentials } from '@/utils/credentialStore';
import { Services } from '@/stores/account/types';
import AnimatedPressable from '@/ui/components/AnimatedPressable';
import Stack from '@/ui/components/Stack';
import Typography from '@/ui/components/Typography';
import { useAlert } from '@/ui/components/AlertProvider';

export default function CreateEventScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id?: string }>();
    const alert = useAlert();
    const isEditing = !!id;

    const [title, setTitle] = useState('');
    const [timeStart, setTimeStart] = useState('');
    const [timeEnd, setTimeEnd] = useState('');
    const [description, setDescription] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isEditing) {
            fetchEvents().then((events) => {
                const existing = events.find((e) => e.id === id);
                if (existing) {
                    setTitle(existing.title);
                    setTimeStart(existing.time_start.slice(0, 16));
                    setTimeEnd(existing.time_end.slice(0, 16));
                    setDescription(existing.description ?? '');
                    setLinkUrl(existing.link_url ?? '');
                }
            });
        }
    }, [id]);

    const handleSave = async () => {
        if (!title.trim() || !timeStart || !timeEnd) {
            alert.showAlert({
                title: "Champs manquants",
                description: "Le titre et les horaires sont obligatoires.",
                icon: "AlertCircle",
                color: "#D60000"
            });
            return;
        }

        setSaving(true);
        const { username } = await getCredentials(Services.AURIGA) || { username: 'inconnu' };

        const payload = {
            title: title.trim(),
            time_start: new Date(timeStart).toISOString(),
            time_end: new Date(timeEnd).toISOString(),
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

    const inputStyle = {
        borderWidth: 1,
        borderColor: '#00000020',
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
    };

    return (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Typography variant="h4">{isEditing ? "Modifier l'événement" : "Créer un événement"}</Typography>

            <View>
                <Typography variant="caption" color="secondary" style={{ marginBottom: 4 }}>Titre</Typography>
                <RNTextInput style={inputStyle} value={title} onChangeText={setTitle} placeholder="Titre de l'événement" />
            </View>

            <Stack direction="horizontal" gap={12}>
                <View style={{ flex: 1 }}>
                    <Typography variant="caption" color="secondary" style={{ marginBottom: 4 }}>Début</Typography>
                    <RNTextInput style={inputStyle} value={timeStart} onChangeText={setTimeStart} placeholder="2026-09-15T14:00" />
                </View>
                <View style={{ flex: 1 }}>
                    <Typography variant="caption" color="secondary" style={{ marginBottom: 4 }}>Fin</Typography>
                    <RNTextInput style={inputStyle} value={timeEnd} onChangeText={setTimeEnd} placeholder="2026-09-15T16:00" />
                </View>
            </Stack>

            <View>
                <Typography variant="caption" color="secondary" style={{ marginBottom: 4 }}>Description</Typography>
                <RNTextInput
                    style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Détails de l'événement"
                    multiline
                />
            </View>

            <View>
                <Typography variant="caption" color="secondary" style={{ marginBottom: 4 }}>Lien (optionnel)</Typography>
                <RNTextInput style={inputStyle} value={linkUrl} onChangeText={setLinkUrl} placeholder="https://..." autoCapitalize="none" />
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