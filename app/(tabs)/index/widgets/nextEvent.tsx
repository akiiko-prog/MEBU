import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { fetchEvents, SchoolEvent } from '@/services/events';
import Typography from '@/ui/components/Typography';

import EventCard from '@/app/(tabs)/news/components/EventCard';

const HomeNextEventWidget = React.memo(() => {
    const [nextEvent, setNextEvent] = useState<SchoolEvent | null>(null);

    // Recharger à chaque retour sur l'accueil : l'onglet reste monté, donc un
    // événement créé ou modifié entre-temps n'apparaîtrait sinon qu'au redémarrage
    useFocusEffect(
        useCallback(() => {
            fetchEvents().then((events) => {
                const now = new Date();
                const upcoming = events
                    .filter((e) => new Date(e.time_end) >= now)
                    .sort((a, b) => new Date(a.time_start).getTime() - new Date(b.time_start).getTime());
                setNextEvent(upcoming[0] ?? null);
            });
        }, [])
    );

    if (!nextEvent) {
        return (
            <View style={styles.emptyContainer}>
                <Typography variant="body2" style={{ opacity: 0.6 }}>
                    Aucun événement à venir
                </Typography>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <EventCard
                event={nextEvent}
                canEdit={false}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 10,
        paddingBottom: 7,
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    }
});

export default HomeNextEventWidget;
