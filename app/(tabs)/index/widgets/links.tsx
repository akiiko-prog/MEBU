import React from 'react';
import { StyleSheet, View } from 'react-native';

import LinkCard, { LinksList, LinkEvent } from '../components/LinkCard';

const HomeLinksWidget = React.memo(() => {
    const displayedLinks = LinksList.slice(0, 3);

    return (
        <View style={styles.container}>
            {displayedLinks.map((link: LinkEvent, index: number) => (
                <LinkCard
                    key={index}
                    event={link}
                    borderRadius={18}
                    style={{ marginBottom: index === displayedLinks.length - 1 ? 0 : 10 }}
                />
            ))}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 10,
        paddingBottom: 7,
    },
});

export default HomeLinksWidget;
