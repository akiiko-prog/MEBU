import { Papicons } from "@getpapillon/papicons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useTheme } from "@react-navigation/native";
import { Ban, CalendarRange, Ghost, GraduationCap, Pencil } from "lucide-react-native";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView } from "react-native";
import { Stack as RouterStack } from "expo-router";

import { useSettingsStore } from "@/stores/settings";
import AnimatedPressable from "@/ui/components/AnimatedPressable";
import Icon from "@/ui/components/Icon";
import Item, { Trailing } from "@/ui/components/Item";
import List from "@/ui/components/List";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import { AppColors } from "@/utils/colors";

const NotificationSettings = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const height = useHeaderHeight();

  const settingsStore = useSettingsStore(state => state.personalization);
  const mutateProperty = useSettingsStore(state => state.mutateProperty);

  const defaultColorData = AppColors.find(c => c.colorEnum === settingsStore.colorSelected) || AppColors[0];
  const selectedColor = defaultColorData.mainColor;

  const [selectedGrades, setSelectedGrades] = React.useState<"on" | "off">(settingsStore.grade || "on");
  const [selectedAttendance, setSelectedAttendance] = React.useState<"on" | "off">(settingsStore.attendance || "on");
  const [selectedCancel, setSelectedCancel] = React.useState<"on" | "off">(settingsStore.cancel || "on");
  const [selectedEdit, setSelectedEdit] = React.useState<"on" | "off">(settingsStore.edit || "on");
  const [selectedEvents, setSelectedEvents] = React.useState<"on" | "off">(settingsStore.intracomEvents || "on");

  useEffect(() => { mutateProperty("personalization", { grade: selectedGrades }); }, [selectedGrades]);
  useEffect(() => { mutateProperty("personalization", { attendance: selectedAttendance }); }, [selectedAttendance]);
  useEffect(() => { mutateProperty("personalization", { cancel: selectedCancel }); }, [selectedCancel]);
  useEffect(() => { mutateProperty("personalization", { edit: selectedEdit }); }, [selectedEdit]);
  useEffect(() => { mutateProperty("personalization", { intracomEvents: selectedEvents }); }, [selectedEvents]);

  const items: { icon: React.ReactNode; title: string; description: string; selected: "on" | "off"; setSelected: (v: "on" | "off") => void }[] = [
    {
      icon: <GraduationCap width={22} height={22} stroke="#818181" />,
      title: t("Notif_Grades_Title"),
      description: t("Notif_Grades_Description"),
      selected: selectedGrades,
      setSelected: setSelectedGrades,
    },
    {
      icon: <Ghost width={22} height={22} stroke="#818181" />,
      title: t("Notif_Attendance_Title"),
      description: t("Notif_Attendance_Description"),
      selected: selectedAttendance,
      setSelected: setSelectedAttendance,
    },
    {
      icon: <Ban width={22} height={22} stroke="#818181" />,
      title: t("Notif_CourseCancel_Title"),
      description: t("Notif_CourseCancel_Description"),
      selected: selectedCancel,
      setSelected: setSelectedCancel,
    },
    {
      icon: <Pencil width={22} height={22} stroke="#818181" />,
      title: t("Notif_CourseEdit_Title"),
      description: t("Notif_CourseEdit_Description"),
      selected: selectedEdit,
      setSelected: setSelectedEdit,
    },
    {
      icon: <CalendarRange width={22} height={22} stroke="#818181" />,
      title: t("Notif_IntracomEvents_Title"),
      description: t("Notif_IntracomEvents_Description"),
      selected: selectedEvents,
      setSelected: setSelectedEvents,
    },
  ];

  return (
    <>
      <RouterStack.Screen options={{ title: "Notifications" }} />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40
        }}
        contentInsetAdjustmentBehavior="always"
        style={{ flex: 1 }}
      >
        <List>
          {items.map(({ icon, title, description, selected, setSelected }) => (
            <Item key={title}>
              <Icon size={30}>{icon}</Icon>
              <Typography variant="title">{title}</Typography>
              <Typography variant="caption" color="secondary">{description}</Typography>
              <Trailing>
                <Stack bordered={true} direction="horizontal" height={40} hAlign="center" vAlign="center">
                  <AnimatedPressable onPress={() => setSelected("on")} style={{ overflow: "hidden", height: "100%" }}>
                    <Stack style={{ overflow: "hidden", paddingHorizontal: 15, height: "100%" }}
                      hAlign="center" vAlign="center"
                      backgroundColor={selected === "on" ? selectedColor : "transparent"}
                      radius={20}
                    >
                      <Papicons name="check" opacity={selected === "on" ? 1 : 0.7} color={selected === "on" ? "#FFF" : theme.colors.text} />
                    </Stack>
                  </AnimatedPressable>
                  <AnimatedPressable onPress={() => setSelected("off")} style={{ overflow: "hidden", height: "100%" }}>
                    <Stack style={{ overflow: "hidden", paddingHorizontal: 15, height: "100%" }}
                      hAlign="center" vAlign="center"
                      backgroundColor={selected === "off" ? selectedColor : "transparent"}
                      radius={20}
                    >
                      <Papicons name="cross" opacity={selected === "off" ? 1 : 0.7} color={selected === "off" ? "#FFF" : theme.colors.text} />
                    </Stack>
                  </AnimatedPressable>
                </Stack>
              </Trailing>
            </Item>
          ))}
        </List>
      </ScrollView>
    </>
  );
};

export default NotificationSettings;
