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
    { title: "Signalement", url: "https://epita.signalement.net/", color: "#3A56D0" },
    { title: "Intranet", url: "https://intra.forge.epita.fr/", color: "#C50017" },
    { title: "Moodle", url: "https://moodle.epita.fr/", color: "#6BAE00" },
    { title: "Moodle (Exam)", url: "https://moodle-exam.epita.fr/login/index.php?loginredirect=1", color: "#0062e2" },
    { title: "News", url: "https://news.epita.fr/", color: "#e200b1" },
    { title: "EPITA IT", url: "https://epita.it/", color: "#fa8c3a" },
    { title: "Console", url: "https://console.bocal.org/", color: "#26B290" },
    { title: "Fleet", url: "https://fleet.pie.cri.epita.fr/", color: "#C50066" },
    { title: "Study Abroad", url: "https://epitafr.sharepoint.com/sites/EPITAStudyAbroad", color: "#DD6B00" },
    { title: "Scolarités", url: "https://epitafr.sharepoint.com/sites/EPITAscolarites", color: "#962DD8" },
    { title: "Tickets", url: "https://tickets.forge.epita.fr/", color: "#2DB9D8" },
    { title: "Gitlab", url: "https://gitlab.cri.epita.fr/", color: "#26B290" },
    { title: "Relations Entreprises", url: "https://epita.net/", color: "#2112ec" },
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

