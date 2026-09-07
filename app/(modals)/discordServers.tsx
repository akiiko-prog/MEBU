import { Papicons } from '@getpapillon/papicons';
import { useTheme } from "@react-navigation/native";
import { t } from "i18next";
import React from "react";
import { View, Linking, ScrollView } from "react-native";
import { useAlert } from "@/ui/components/AlertProvider";

import Icon from "@/ui/components/Icon";
import Typography from "@/ui/components/Typography";
import List from "@/ui/components/List";
import Item, { Leading, Trailing } from "@/ui/components/Item";
import { storage } from '@/services/auriga';

const PromoLinksByYeats: Record<string, string> = {
  2025: "https://discord.com/invite/SR5jzVA",
  2026: "https://discord.com/invite/wJn9Ku98zp",
  2027: "https://discord.com/invite/3ZJDy7h9pY",
  2028: "https://discord.com/invite/AbqK9R2mPW",
  2029: "https://discord.com/invite/D8HQU6v59w",
  2030: "https://discord.com/invite/6bsJgjYcQM",
}


const DISCORD_INVITES = [
  {
    name: "Chrysalide App",
    url: "https://discord.gg/H6cyHB5Rzg",
    description: "Communauté principale",
  },
];

export default function DiscordServersModal() {
  const theme = useTheme();
  const colors = theme.colors;
  const alert = useAlert();

  const aurigaData = JSON.parse(storage.getString("auriga_userdata") || "{}");
  const studentClass = aurigaData?.student?.class as string;

  let description = t("Discord_InvalidClass_Description") + "\n\n" + t("Discord_InvalidClass_Description_2") + "\n";
  for (const year in PromoLinksByYeats) {
    description += year + ": " + PromoLinksByYeats[year] + "\n";
  }

  const invalidClass = () => alert.showAlert({
    title: t("Discord_InvalidClass_Title"),
    description: description,
    icon: "AlertCircle",
    color: "#D60000"
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: 40, gap: 20 }}
    >
      <List>
        <Item onPress={() => Linking.openURL(DISCORD_INVITES[0].url)}>
          <Leading>
            <Icon>
              <Papicons name="TextBubble" />
            </Icon>
          </Leading>
          <Typography variant="title">
            {t("Settings_About_Discord")}
          </Typography>
          <Typography variant="caption" color="secondary">
            Chrysalide App
          </Typography>
          <Trailing>
            <Icon>
              <Papicons name="ChevronRight" />
            </Icon>
          </Trailing>
        </Item>

        <Item onPress={() => { if (PromoLinksByYeats[studentClass]) Linking.openURL(PromoLinksByYeats[studentClass]); else invalidClass() }}>
          <Leading>
            <Icon>
              <Papicons name="TextBubble" />
            </Icon>
          </Leading>
          <Typography variant="title">
            Discord Promo
          </Typography>
          <Typography variant="caption" color="secondary">
            Lien à changer
          </Typography>
          <Trailing>
            <Icon>
              <Papicons name="ChevronRight" />
            </Icon>
          </Trailing>
        </Item>
      </List>
    </ScrollView>
  )
}
