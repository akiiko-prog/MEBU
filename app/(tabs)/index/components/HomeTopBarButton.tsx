import { Papicons } from '@getpapillon/papicons';
import React from 'react';

import AnimatedPressable from '@/ui/components/AnimatedPressable';
import Icon from '@/ui/components/Icon';
import Stack from '@/ui/components/Stack';
import { Image } from 'react-native';

interface HomeTopBarButtonProps {
  icon: string;
  onPress?: () => void;
  backgroundColor?: string;
}

const HomeTopBarButton: React.FC<HomeTopBarButtonProps> = ({ icon, onPress, backgroundColor }) => {
  return (
    <AnimatedPressable
      onPressIn={onPress}
    >
      <Stack
        card
        style={{
          width: 42,
          height: 42,
          borderRadius: 30,
        }}
        hAlign='center'
        vAlign='center'
        noShadow
        backgroundColor={backgroundColor || '#FFFFFF50'}
      >
        {icon === 'discord' ? (
          <Icon size={23} fill='white'>
            <Image source={require('@/assets/images/discordIcon.png')} style={{ width: 100, height: 100 }} />
          </Icon>
        ) : (
          <Icon size={26} fill='white'>
            <Papicons name={icon} />
          </Icon>
        )}
      </Stack>
    </AnimatedPressable>
  );
};

export default HomeTopBarButton;
