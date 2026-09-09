import { Papicons } from '@getpapillon/papicons';
import { Link, useTheme } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { Linking, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Reanimated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

import Typography from '@/ui/components/Typography';

export interface LinkEvent {
    title: string;
    url: string;
    color: string;
}

interface LinkCardProps {
    event: LinkEvent;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

export const LinksList = [
    { title: "ESME France", url: "https://www.esme.fr/", color: "#C50017" },
    { title: "Moodle", url: "https://moodle.esme.fr/", color: "#6BAE00" },
    { title: "Auriga", url: "https://my.esme.fr/", color: "#fa8c3a" },
    { title: "Planette esme", url: "https://esmefr.sharepoint.com/sites/AccueilESME", color: "#0062e2" },
];

const LinkCard: React.FC<LinkCardProps> = ({ event, borderRadius = 20, style }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const handlePressIn = () => {
        scale.value = withSpring(0.95);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const handlePress = () => {
        Linking.openURL(event.url);
    };

    const colorIndex = event.color || "#3A56D0";
    const bgColor = colorIndex + "1A";

    return (
        <AnimatedPressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[styles.cardContainer, { borderRadius, backgroundColor: bgColor }, style, animatedStyle]}
        >
            <View style={styles.contentContainer}>
                <View style={styles.textContainer}>
                    <Typography variant="h5" style={[styles.title, { color: colorIndex }]} numberOfLines={1}>
                        {event.title}
                    </Typography>
                </View>
                <View style={styles.iconContainer}>
                    <Papicons name={"ChevronRight"} size={20} color={colorIndex} />
                </View>
            </View>
        </AnimatedPressable>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        width: '100%',
        borderCurve: 'continuous',
        marginBottom: 10,
        overflow: 'hidden',
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        gap: 12,
    },
    indicatorLine: {
        width: 4,
        height: '100%',
        minHeight: 28,
        borderRadius: 2,
    },
    iconContainer: {
        width: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        fontWeight: '700',
        fontSize: 16,
    },
});

export default LinkCard;

