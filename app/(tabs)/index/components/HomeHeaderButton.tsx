import { Papicons } from '@getpapillon/papicons';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AnimatedPressable from '@/ui/components/AnimatedPressable';
import Stack from '@/ui/components/Stack';
import Typography from '@/ui/components/Typography';

export interface HomeHeaderButtonItem {
  title: string;
  icon: string;
  color: string;
  description: string;
  rightLabel?: string;
  onPress?: () => void;
}

interface HomeHeaderButtonProps {
  item: HomeHeaderButtonItem;
}

const HomeHeaderButton: React.FC<HomeHeaderButtonProps> = ({ item }) => {
  const { colors } = useTheme();

  return (
    <AnimatedPressable
      style={styles.headerBtn}
      onPress={item.onPress}
    >
      <Stack
        direction='horizontal'
        card
        inline flex
        padding={[10, 10]}
        hAlign='center'
        vAlign='center'
        gap={10}
      >
        {/* Icône */}
        <View
          style={{
            backgroundColor: item.color + 30,
            borderRadius: 50,
            borderCurve: 'continuous',
            padding: 7
          }}
        >
          <Papicons name={item.icon} color={item.color} size={25} />
        </View>

        {/* Texte principal (titre + description) */}
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <Typography nowrap inline variant="title">{item.title}</Typography>
          <Typography nowrap inline variant="body2" color='secondary'>{item.description}</Typography>
        </View>

        {/* Label droit optionnel (heures totales) */}
        {item.rightLabel ? (
          <View style={styles.rightLabelContainer}>
            <Text style={[styles.rightLabelText, { color: item.color }]}>
              {item.rightLabel}
            </Text>
            <Text style={[styles.rightLabelSub, { color: colors.text + '80' }]}>
              total
            </Text>
          </View>
        ) : null}
      </Stack>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  headerBtn: {
    flex: 1,
    width: "100%",
    flexDirection: "row",
  },
  rightLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    minWidth: 44,
  },
  rightLabelText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  rightLabelSub: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 1,
  },
});

export default HomeHeaderButton;
