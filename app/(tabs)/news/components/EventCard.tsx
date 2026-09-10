import { Papicons } from '@getpapillon/papicons';
import React from 'react';
import { Linking } from 'react-native';

import AnimatedPressable from '@/ui/components/AnimatedPressable';
import Icon from '@/ui/components/Icon';
import Stack from '@/ui/components/Stack';
import Typography from '@/ui/components/Typography';

import { SchoolEvent } from '@/services/events';

interface EventCardProps {
    event: SchoolEvent;
    canEdit: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

const EventCard: React.FC<EventCardProps> = ({ event, canEdit, onEdit, onDelete }) => {
    return (
        <Stack card style={{ padding: 14, gap: 6 }}>
            <Stack direction="horizontal" hAlign="center" gap={8}>
                <Typography variant="title" style={{ flex: 1 }}>
                    {event.title}
                </Typography>
                {canEdit && (
                    <Stack direction="horizontal" gap={8}>
                        <AnimatedPressable onPress={onEdit}>
                            <Icon size={20} opacity={0.6}>
                                <Papicons name="Pencil" />
                            </Icon>
                        </AnimatedPressable>
                        <AnimatedPressable onPress={onDelete}>
                            <Icon size={20} opacity={0.6}>
                                <Papicons name="Trash" />
                            </Icon>
                        </AnimatedPressable>
                    </Stack>
                )}
            </Stack>

            <Typography variant="caption" color="secondary">
                {formatDate(event.time_start)} · {formatTime(event.time_start)} - {formatTime(event.time_end)}
            </Typography>

            {event.description && (
                <Typography variant="body1" color="secondary" numberOfLines={4}>
                    {event.description}
                </Typography>
            )}

            {event.link_url && (
                <AnimatedPressable onPress={() => Linking.openURL(event.link_url!)}>
                    <Typography variant="body2" color="primary">
                        {event.link_url}
                    </Typography>
                </AnimatedPressable>
            )}
        </Stack>
    );
};

export default EventCard;