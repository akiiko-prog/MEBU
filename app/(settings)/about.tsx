import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, ScrollView, Image } from "react-native";

import SettingsHeader from "@/components/SettingsHeader";
import packageJson from "@/package.json"
import Avatar from "@/ui/components/Avatar";
import Icon from "@/ui/components/Icon";
import Item, { Leading, Trailing } from "@/ui/components/Item";
import List from "@/ui/components/List";
import Typography from "@/ui/components/Typography";
import { getInitials } from "@/utils/chats/initials";
import { Contributor, getContributors } from "@/utils/github/contributors";


import { useSettingsStore } from "@/stores/settings";

export default function SettingsAbout() {
  const { t } = useTranslation();
  const Theme = useTheme();
  const settingsStore = useSettingsStore(state => state.personalization);
  const mutateProperty = useSettingsStore(state => state.mutateProperty);

  const [contributors] = useState<Contributor[]>([])
  const Teams = [
    {
      title: "Arthaud Delvau",
      description: "Dev",
      login: "Arthaud",
      leading: <Avatar size={40} shape="square" initials={getInitials("Arthaud Delvau")} />,
      onPress: () => Linking.openURL("https://www.linkedin.com/in/arthaud-delvau-32205638b/")
    },
    {
      title: "Elouan Gleyze",
      description: "Dev",
      login: "Elouan",
      leading: <Avatar size={40} shape="square" initials={getInitials("Elouan Gleyze")} />,
      onPress: () => Linking.openURL("https://www.linkedin.com/in/elouan-gleyze-a43207255/")
    }
  ]
  const Items = [
    /*
    {
      title: t("Settings_Website"),
      description: t("Settings_Website_Description"),
      leading: <Papicons name="info" />,
      onPress: () => Linking.openURL('mebu.app'),
    },*/
    {
      title: t("Settings_About_Discord"),
      description: t("Settings_About_Discord_Description"),
      leading: <Papicons name="TextBubble" />,
      onPress: () => Linking.openURL('https://discord.gg/3QYJJj4cr8'),
    },
  ];

  const [tapCount, setTapCount] = React.useState(0);

  const handleVersionTap = () => {
    setTapCount(prev => prev + 1);
    if (tapCount + 1 >= 8) {
      setTapCount(0);
      if (settingsStore.showDevMode) {
        Alert.alert("Dev Mode", "Dev mode désactivé!");
        mutateProperty("personalization", { showDevMode: false });
      } else {
        Alert.alert("Dev Mode", "Dev mode activé!");
        mutateProperty("personalization", { showDevMode: true });
      }
    }
  };

  const Infos = [
    {
      title: t("Settings_App_Version"),
      description: packageJson.version,
      leading: <Papicons name="Butterfly" />,
      onPress: handleVersionTap,
    },
    {
      title: t("Settings_About_Dependency_Version"),
      description: `Expo: ${packageJson.dependencies?.expo || "N/A"} | RN: ${packageJson.dependencies?.["react-native"] || "N/A"}`,
      leading: <Papicons name="Code" />,
    }
  ];

  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, gap: 20 }}
      contentInsetAdjustmentBehavior="always"
    >
      <SettingsHeader
        color="#0060D6"
        title={t('Settings_About_Chrysalide_Behind')}
        description={t('Settings_About_Chrysalide_Behind_Description')}
        imageSource={require("@/assets/app.icon/Assets/Vector (Stroke).png")}
        height={270}
      />
      <List>
        {Teams.map((item, index) => (
          <Item
            key={index}
            onPress={item.onPress}
          >
            <Leading>
              <Icon>
                {item.leading}
              </Icon>
            </Leading>
            <Typography variant="title">
              {item.title}
            </Typography>
            <Typography variant="caption" color="secondary">
              {t(item.description)}
            </Typography>
            <Trailing>
              {item.onPress && (
                <Icon>
                  <Papicons name="ChevronRight" />
                </Icon>
              )}
            </Trailing>
          </Item>
        ))}
      </List>
      <List>
        {Items.map((item, index) => (
          <Item
            key={index}
            onPress={item.onPress}
          >
            <Leading>
              <Icon>
                {item.leading}
              </Icon>
            </Leading>
            <Typography variant="title">
              {item.title}
            </Typography>
            <Typography variant="caption" color="secondary">
              {item.description}
            </Typography>
            <Trailing>
              <Icon>
                <Papicons name="ChevronRight" />
              </Icon>
            </Trailing>
          </Item>
        ))}
      </List>
      <List>
        {contributors.map(item => (
          <Item key={item.login} onPress={() => Linking.openURL(item.html_url)}>
            <Leading>
              <Avatar size={40} shape="square" initials={getInitials(item.login)} imageUrl={item.avatar_url} />
            </Leading>
            <Typography>{item.login}</Typography>
            <Typography color="secondary">{item.contributions} contributions</Typography>
          </Item>
        ))}
      </List>
      <List>
        {Infos.map((item, index) => (
          <Item
            key={index}
            onPress={item.onPress}
          >
            <Leading>
              <Icon>
                {item.leading}
              </Icon>
            </Leading>
            <Typography variant="title">
              {item.title}
            </Typography>
            <Typography variant="caption" color="secondary">
              {item.description}
            </Typography>
          </Item>
        ))}
      </List>
    </ScrollView>
  );
}
