/* eslint-disable @typescript-eslint/no-require-imports */
import { Papicons } from '@getpapillon/papicons';
import { useTheme } from '@react-navigation/native';
import { UnknownInputParams } from 'expo-router';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import { useFlagsStore } from '@/stores/flags';

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

  // Même connexion Auriga pour tous : le choix indique seulement si l'app doit
  // masquer les notes et les absences (inexistantes pour un enseignant)
  const loginAs = (teacher: boolean) => {
    useFlagsStore.getState().setTeacher(teacher);
    useFlagsStore.getState().setCom(false);
    redirect({ pathname: '../university/multi/aurigaAuth', options: { color: "#0060D6", university: "Microsoft (ESME)", url: "https://ionisesme-auth.np-auriga.nfrance.net/auth/realms/npionisesme/protocol/openid-connect/auth?client_id=np-front&redirect_uri=https%3A%2F%2Fmy.esme.fr%2F%23%2FmainContent%2Fwelcome&state=b0d51531-8196-40d8-879a-65006e6a077c&response_mode=fragment&response_type=code&scope=openid&nonce=76fd097a-cf70-4f89-8a38-2f7e80b77475&prompt=login&code_challenge=8AH2655_0ZuKl4XeB_TOu0Jbr1HJQoJdPTzG_Rf4Yig&code_challenge_method=S256" } });
  };

  const image = theme.dark ? require("@/assets/images/Auriga_dark.png") : require("@/assets/images/Auriga_light.png");
  const style = { backgroundColor: theme.dark ? colors.border : "black" };

  return [
    {
      name: "university",
      title: "Étudiant ESME",
      type: "other",
      image,
      onPress: () => loginAs(false),
      variant: 'primary' as const,
      style,
    },
    {
      name: "university-teacher",
      title: "Enseignant ESME",
      type: "other",
      image,
      onPress: () => loginAs(true),
      variant: 'primary' as const,
      style,
    },
    {
      // Pas de compte Auriga : connexion via Supabase Auth
      name: "school-com",
      title: "Communication ESME",
      type: "other",
      icon: <Papicons name={"newspaper"} />,
      onPress: () => redirect({ pathname: '../com/login' }),
      variant: 'primary' as const,
      style,
    },
  ]
}
