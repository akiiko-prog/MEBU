import { Papicons } from '@getpapillon/papicons';
import { LiquidGlassView } from '@sbaiahmed1/react-native-blur';
import React from 'react';
import { Pressable, Image } from 'react-native';

import Icon from '@/ui/components/Icon';

interface HomeTopBarButtonProps {
  icon: string;
  onPress?: () => void;
}

const HomeTopBarButton: React.FC<HomeTopBarButtonProps> = ({ icon, onPress }) => {
  return (
    <LiquidGlassView
      glassType="clear"
      isInteractive={true}
      glassOpacity={0}
      style={{
        width: 42,
        height: 42,
        borderRadius: 30,
      }}
    >
      <Pressable
        onPress={onPress}
        style={{
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
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
      </Pressable>
    </LiquidGlassView>
  );
};

export default HomeTopBarButton;
