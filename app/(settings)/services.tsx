import { useFocusEffect, useRouter } from "expo-router";
import { UserX2Icon } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, View } from "react-native";

import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import Icon from "@/ui/components/Icon";
import Item from "@/ui/components/Item";
import List from "@/ui/components/List";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import { hasCredentials, removeCredentials } from "@/utils/credentialStore";
import { storage } from "@/services/auriga";

export default function SettingsServices() {
  const accountStore = useAccountStore();
  const { t } = useTranslation();
  const router = useRouter();

  const [intracomConnected, setIntracomConnected] = useState(false);
  const [aurigaConnected, setAurigaConnected] = useState(false);
  const [attendanceConnected, setAttendanceConnected] = useState(false);

  const checkConnections = useCallback(async () => {
    const isIntracom = await hasCredentials(Services.INTRACOM);
    const isAuriga = await hasCredentials(Services.AURIGA);
    const isAttendance = await hasCredentials(Services.ATTENDANCE);

    setIntracomConnected(isIntracom);
    setAurigaConnected(isAuriga);
    setAttendanceConnected(isAttendance);
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkConnections();
    }, [checkConnections])
  );

  const handleDisconnectIntracom = async () => {
    try {
      await removeCredentials(Services.INTRACOM);

      const account = accountStore.accounts.find(a => a.services.some(s => s.serviceId === Services.INTRACOM && s.auth.additionals?.hasStoredCredentials === 1));


      if (account) {
        try {
          const { clearIntracomData } = await import('@/database/cleanup');
          await clearIntracomData(account.id);

          accountStore.setServiceCredentials(Services.INTRACOM, false, account.id);

        } catch (e) {
          console.error("Error clearing Intracom data:", e);
        }
      } else {
        accountStore.setServiceCredentials(Services.INTRACOM, false);
      }

      Alert.alert(t("Settings_Services_Alert_Success"), t("Settings_Services_Alert_Disconnected"));
      await checkConnections();
    } catch (error) {
      console.error("Failed to disconnect Intracom", error);
      Alert.alert(t("Settings_Services_Alert_Error"), t("Settings_Services_Alert_Failed_Disconnect"));
    }
  };

  const handleDisconnectAuriga = async () => {
    try {
      await removeCredentials(Services.AURIGA);

      // Find the Multi service with auriga type (Auriga uses Services.MULTI, not Services.AURIGA)
      const account = accountStore.accounts.find(a =>
        a.services.some(s =>
          s.serviceId === Services.MULTI &&
          s.auth?.additionals?.type === "auriga" &&
          s.auth.additionals?.hasStoredCredentials === 1
        )
      );

      if (account) {
        try {
          const { clearAurigaData } = await import('@/database/cleanup');
          await clearAurigaData(account.id);

          const multiService = account.services.find(
            s => s.serviceId === Services.MULTI && s.auth?.additionals?.type === "auriga"
          );
          if (multiService) {
            accountStore.updateServiceAuthData(multiService.id, {
              ...multiService.auth,
              additionals: {
                ...multiService.auth.additionals,
                hasStoredCredentials: 0,
              },
            });
          }
        } catch (e) {
          console.error("Error clearing Auriga data", e);
        }
      }

      Alert.alert(t("Settings_Services_Alert_Success"), t("Settings_Services_Alert_Disconnected"));
      await checkConnections();
    } catch (error) {
      console.error("Failed to disconnect Auriga", error);
      Alert.alert(t("Settings_Services_Alert_Error"), t("Settings_Services_Alert_Failed_Disconnect"));
    }
  };

  const handleDisconnectAttendance = async () => {
    try {
      await removeCredentials(Services.ATTENDANCE);

      const account = accountStore.accounts.find(a => a.services.some(s => s.serviceId === Services.ATTENDANCE && s.auth.additionals?.hasStoredCredentials === 1));

      if (account) {
        try {
          const { clearAttendanceData } = await import('@/database/cleanup');
          await clearAttendanceData(account.id);

          accountStore.setServiceCredentials(Services.ATTENDANCE, false, account.id);
        } catch (e) {
          console.error("Error clearing Attendance data", e);
        }
      } else {
        accountStore.setServiceCredentials(Services.ATTENDANCE, false);
      }

      Alert.alert(t("Settings_Services_Alert_Success"), t("Settings_Services_Alert_Disconnected"));
      await checkConnections();
    } catch (error) {
      console.error("Failed to disconnect Attendance", error);
      Alert.alert(t("Settings_Services_Alert_Error"), t("Settings_Services_Alert_Failed_Disconnect"));
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16 }}
      contentInsetAdjustmentBehavior="always"
      style={{ width: '100%', height: '100%' }}
    >
      <List>
        <Item
          onPress={() => {
            console.log("[Services] Intracom Item Pressed. Connected:", intracomConnected);
            if (intracomConnected) {
              Alert.alert(
                t("Settings_Services_Modal_Title_IntracomDisonnection"),
                t("Settings_Services_Modal_Description_Disconnection"),
                [
                  { text: t("Settings_Services_CancelButton"), style: "cancel" },
                  { text: t("Settings_Services_DisconnectButton"), style: "destructive", onPress: handleDisconnectIntracom }
                ]
              );
            } else {
              router.push('/(modals)/login-intracom');
            }
          }}
        >
          <Stack direction="horizontal" vAlign="center" gap={12} style={{ flex: 1 }}>
            {/* Use a better icon or image for Intracom if available */}
            <Typography variant="title">Intracom</Typography>
            <View style={{ flex: 1 }} />
            <Typography variant="body1" color="secondary">
              {intracomConnected ? t("Settings_Services_Connected") : t("Settings_Services_NotConnected")}
            </Typography>
          </Stack>
        </Item>

        <Item
          onPress={() => {
            if (aurigaConnected) {
              Alert.alert(
                t("Settings_Services_Modal_Title_AurigaDisonnection"),
                t("Settings_Services_Modal_Description_Disconnection"),
                [
                  { text: t("Settings_Services_CancelButton"), style: "cancel" },
                  { text: t("Settings_Services_DisconnectButton"), style: "destructive", onPress: handleDisconnectAuriga }
                ]
              );
            } else {
              storage.set("linked_from_settings", "true");
              router.push('/(onboarding)/university/multi/aurigaAuth');
            }
          }}
        >
          <Stack direction="horizontal" vAlign="center" gap={12} style={{ flex: 1 }}>
            <Typography variant="title">Auriga</Typography>
            <View style={{ flex: 1 }} />
            <Typography variant="body1" color="secondary">
              {aurigaConnected ? t("Settings_Services_Connected") : t("Settings_Services_NotConnected")}
            </Typography>
          </Stack>
        </Item>

        <Item
          onPress={() => {
            if (attendanceConnected) {
              Alert.alert(
                t("Settings_Services_Modal_Title_AbsenceDisonnection"),
                t("Settings_Services_Modal_Description_Disconnection"),
                [
                  { text: t("Settings_Services_CancelButton"), style: "cancel" },
                  { text: t("Settings_Services_DisconnectButton"), style: "destructive", onPress: handleDisconnectAttendance }
                ]
              );
            } else {
              router.push('/(modals)/login-attendance');
            }
          }}
        >
          <Stack direction="horizontal" vAlign="center" gap={12} style={{ flex: 1 }}>
            <Typography variant="title">Absences</Typography>
            <View style={{ flex: 1 }} />
            <Typography variant="body1" color="secondary">
              {attendanceConnected ? t("Settings_Services_Connected") : t("Settings_Services_NotConnected")}
            </Typography>
          </Stack>
        </Item>
      </List>

      {accountStore.accounts.length === 0 && (
        <Stack
          vAlign="center"
          hAlign="center"
          padding={16}
          gap={0}
        >
          <Icon opacity={0.5} style={{ marginBottom: 8 }}>
            <UserX2Icon size={36} />
          </Icon>
          <Typography variant="h4" align="center">
            Aucun compte lié
          </Typography>
          <Typography variant="body1" color="secondary" align="center">
            Ajoute un compte en appuyant sur le bouton ci-dessus.
          </Typography>
        </Stack>
      )}
    </ScrollView>
  );
}
