import { Papicons } from "@getpapillon/papicons";
import { MenuAction, MenuView } from '@react-native-menu/menu';
import { LiquidGlassView } from '@sbaiahmed1/react-native-blur';
import React from "react";

import { PapillonAppearIn, PapillonAppearOut } from "../utils/Transition";
import { Dynamic } from "./Dynamic";
import Icon from "./Icon";
import Stack from "./Stack";
import Typography from "./Typography";

const ChipButton: React.FC<React.PropsWithChildren<{
  onPress?: () => void;
  icon?: string;
  chevron?: boolean;
  onPressAction?: ({ nativeEvent }: { nativeEvent: { event: string } }) => void;
  actions: MenuAction[];
}>> = ({ onPress, icon, children, chevron, onPressAction, actions }) => {
  return (
    <LiquidGlassView
      glassType="regular"
      isInteractive={true}
      glassTintColor="transparent"
      glassOpacity={0}
      style={{
        borderRadius: 300,
        borderCurve: 'continuous',
        zIndex: 999999,
        flexShrink: 1,
      }}
    >
      <MenuView onPressAction={onPressAction} actions={actions} style={{ flexShrink: 1 }}>
        <Stack animated direction="horizontal" hAlign="center" gap={8} padding={[12, 6]} radius={200} inline style={{ flexShrink: 1, maxWidth: '100%' }}>
          {icon &&
            <Dynamic animated>
              <Icon style={{ marginLeft: -2 }} size={24}>
                <Papicons name={icon} />
              </Icon>
            </Dynamic>
          }

          {children &&
            <Dynamic animated entering={PapillonAppearIn} exiting={PapillonAppearOut} key={"chip-text:" + children?.toString()} style={{ flexShrink: 1 }}>
              <Typography numberOfLines={1} style={{ flexShrink: 1 }}>
                {children}
              </Typography>
            </Dynamic>
          }

          {chevron &&
            <Dynamic animated>
              <Icon size={20} opacity={0.5}>
                <Papicons name="chevrondown" />
              </Icon>
            </Dynamic>
          }
        </Stack>
      </MenuView>
    </LiquidGlassView>
  );
}

export default ChipButton;