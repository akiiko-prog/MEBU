import { Stack } from 'expo-router';
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import LinkCard, { LinksList } from '../(tabs)/index/components/LinkCard';

export default function LinksListModal() {
    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Liens utiles', headerLargeTitle: true }} />
            <FlatList
                data={LinksList}
                renderItem={({ item, index }) => (
                    <LinkCard
                        event={item}
                        borderRadius={18}
                        style={{ marginBottom: index === LinksList.length - 1 ? 0 : 10 }}
                    />
                )}
                keyExtractor={(item) => item.url}
                contentContainerStyle={styles.scrollContent}
                contentInsetAdjustmentBehavior="automatic"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
});
