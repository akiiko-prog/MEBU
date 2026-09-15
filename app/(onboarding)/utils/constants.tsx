/* eslint-disable @typescript-eslint/no-require-imports */
import { useTheme } from '@react-navigation/native';
import { UnknownInputParams } from 'expo-router';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

export interface SupportedService {
  name: string;
  title: string;
  type: string;
  image?: NodeRequire;
  onPress: () => void;
  variant: string;
  color?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GetSupportedServices(redirect: (path: { pathname: string, options?: UnknownInputParams }) => void): SupportedService[] {
  const theme = useTheme();
  const { colors } = theme;

  return [
    {
      name: "university",
      title: "ESME",
      type: "other",
      image: theme.dark ? require("@/assets/images/Auriga_dark.png") : require("@/assets/images/Auriga_light.png"),
      onPress: () => {
        redirect({ pathname: '../university/multi/aurigaAuth', options: { color: "#0060D6", university: "Microsoft (ESME)", url: "https://ionisesme-auth.np-auriga.nfrance.net/auth/realms/npionisesme/protocol/openid-connect/auth?client_id=np-front&redirect_uri=https%3A%2F%2Fmy.esme.fr%2F%23%2FmainContent%2Fwelcome&state=b0d51531-8196-40d8-879a-65006e6a077c&response_mode=fragment&response_type=code&scope=openid&nonce=76fd097a-cf70-4f89-8a38-2f7e80b77475&prompt=login&code_challenge=8AH2655_0ZuKl4XeB_TOu0Jbr1HJQoJdPTzG_Rf4Yig&code_challenge_method=S256" } });
      },
      variant: 'primary' as const,
      style: { backgroundColor: theme.dark ? colors.border : "black" },
    },
  ]
}
