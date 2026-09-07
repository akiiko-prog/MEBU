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
      title: "Auriga (EPITA)",
      type: "other",
      image: theme.dark ? require("@/assets/images/Auriga_dark.png") : require("@/assets/images/Auriga_light.png"),
      onPress: () => {
        redirect({ pathname: '../university/multi/aurigaAuth', options: { color: "#0060D6", university: "Microsoft (EPITA)", url: "https://ionisesme-auth.np-auriga.nfrance.net/auth/realms/npionisesme/protocol/openid-connect/auth?client_id=np-front&redirect_uri=https%3A%2F%2Fmy.esme.fr%2F%23%2FmainContent%2Fwelcome&state=b0d51531-8196-40d8-879a-65006e6a077c&response_mode=fragment&response_type=code&scope=openid&nonce=76fd097a-cf70-4f89-8a38-2f7e80b77475&prompt=login&code_challenge=8AH2655_0ZuKl4XeB_TOu0Jbr1HJQoJdPTzG_Rf4Yig&code_challenge_method=S256" } });
      },
      variant: 'primary' as const,
      style: { backgroundColor: theme.dark ? colors.border : "black" },
    },
    /*{
      name: "izly",
      title: "Izly",
      type: "other",
      image: require("@/assets/images/izly.png"),
      onPress: () => {
        redirect({ pathname: '../izly/credentials' });
      },
      style: { backgroundColor: theme.dark ? colors.border : "black" },
      variant: ''
    }*/
  ]
}

export interface SupportedUniversity {
  name: string;
  title: string;
  hasLimitedSupport: boolean;
  image?: NodeRequire;
  type: string;
  onPress: () => void;
}

export function GetSupportedUniversities(redirect: (path: { pathname: string, options?: UnknownInputParams }) => void): SupportedUniversity[] {

  return [
    {
      name: "univ-lorraine",
      title: "Université de Lorraine",
      hasLimitedSupport: false,
      image: require("@/assets/images/univ_lorraine.png"),
      type: "main",
      onPress: () => {
        redirect({ pathname: './multi/credentials', options: { color: "#000000", university: "ULorraine", url: "https://mobile-back.univ-lorraine.fr" } });
      },
    },
    {
      name: "univ-nimes",
      title: "Université de Nîmes",
      hasLimitedSupport: false,
      image: require("@/assets/images/univ_nimes.png"),
      type: "main",
      onPress: () => {
        redirect({ pathname: './multi/credentials', options: { color: "#FF341B", university: "UNîmes", url: "https://mobile-back.unimes.fr" } });
      },
    },
    {
      name: "univ-uphf",
      title: "Université Polytechnique Hauts-de-France",
      hasLimitedSupport: false,
      image: require("@/assets/images/univ_uphf.png"),
      type: "main",
      onPress: () => {
        redirect({ pathname: './multi/credentials', options: { color: "#008DB0", university: "UPHF", url: "https://appmob.uphf.fr/backend" } });
      },
    },
  ]
}

export interface NewsService {
  name: string;
  title: string;
  type: "main" | "other" | "separator";
  image: { uri: string };
  onPress: () => void;
}

export function GetNewsServices(redirect: (path: { pathname: string, options?: UnknownInputParams }) => void): NewsService[] {
  return [
    {
      name: "intracom",
      title: "Intracom",
      type: "main",
      image: { uri: 'https://intracom.epita.fr/assets/img/logo-epita.png' },
      onPress: () => {
        redirect({ pathname: '/(modals)/login-intracom' });
      },
    },
  ];
}
