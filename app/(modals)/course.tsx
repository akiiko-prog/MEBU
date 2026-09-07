import * as Papicons from '@getpapillon/papicons';
import { useRoute, useTheme } from "@react-navigation/native";
import { formatDistanceStrict, formatDistanceToNow } from 'date-fns';
import * as DateLocale from 'date-fns/locale';
import i18n, { t } from "i18next";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import LinearGradient from "react-native-linear-gradient";

import ModalOverhead from "@/components/ModalOverhead";
import { useCourseNotes } from "@/hooks/useCourseNotes";
import { Course as SharedCourse } from "@/services/shared/timetable";
import TableFlatList from "@/ui/components/TableFlatList";
import List from "@/ui/components/List";
import Item from "@/ui/components/Item";
import Typography from "@/ui/components/Typography";
import Stack from "@/ui/components/Stack";
import { getSubjectName } from '@/utils/subjects/name';

import { getStatusText } from "../(tabs)/calendar/components/CalendarDay";

interface SubjectInfo {
  name: string;
  originalName: string;
  emoji: string;
  color: string;
}

interface GradesModalProps {
  course: SharedCourse;
  subjectInfo: SubjectInfo;
}

export default function CourseModal() {
  const { params } = useRoute();
  const { colors } = useTheme();
  const [noteInput, setNoteInput] = useState("");

  if (!params) return null;

  const { course, subjectInfo } = params as GradesModalProps;
  const item = course;

  const startTime = Math.floor(course.from.getTime() / 1000);
  const endTime = Math.floor(course.to.getTime() / 1000);

  const { notes, addNote, deleteNote } = useCourseNotes(course.id);

  const handleAddNote = async () => {
    const trimmed = noteInput.trim();
    if (!trimmed) return;
    await addNote(trimmed, "");
    setNoteInput("");
  };

  const handleDeleteNote = (noteId: string) => {
    Alert.alert("Supprimer la note ?", undefined, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => deleteNote(noteId),
      },
    ]);
  };

  const notesContent = (
    <View style={{ gap: 8 }}>
      {notes.length > 0 && (
        <List>
          {notes.map((note, idx) => (
            <Item
              key={note.id}
              isLast={idx === notes.length - 1}
              onPress={() => handleDeleteNote(note.id)}
            >
              <Typography variant="body2" style={{ flex: 1 }}>
                {note.content}
              </Typography>
              <Pressable onPress={() => handleDeleteNote(note.id)} />
            </Item>
          ))}
        </List>
      )}

      <Stack direction="horizontal" gap={8} vAlign="center">
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              color: colors.text,
              borderColor: colors.border,
              flex: 1,
            },
          ]}
          placeholder="Ajouter une note…"
          placeholderTextColor={colors.text + "66"}
          value={noteInput}
          onChangeText={setNoteInput}
          onSubmitEditing={handleAddNote}
          returnKeyType="done"
          multiline
        />
        <Pressable
          onPress={handleAddNote}
          style={[styles.addButton, { backgroundColor: subjectInfo.color }]}
        >
          <Papicons.Plus color="#fff" />
        </Pressable>
      </Stack>
    </View>
  );

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <LinearGradient
          colors={[subjectInfo.color, colors.background]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 500,
            width: "100%",
            zIndex: -9,
            opacity: 0.6,
          }}
        />

        <TableFlatList
          sections={[
            getStatusText(course.status)
              ? {
                title: t("Modal_Course_Status"),
                hideTitle: true,
                items: [
                  {
                    title: getStatusText(course.status),
                    icon: <Papicons.Info />,
                  },
                ],
              }
              : null,
            {
              title: t("Modal_Course_Time"),
              papicon: <Papicons.Clock />,
              items: [
                {
                  title: t("Modal_Course_Start"),
                  description: formatDistanceToNow(startTime * 1000, {
                    locale:
                      DateLocale[i18n.language as keyof typeof DateLocale] ||
                      DateLocale.enUS,
                    addSuffix: true,
                  }),
                  icon: <Papicons.Logout />,
                  trailing: (
                    <Typography variant="header">
                      {new Date(startTime * 1000).toLocaleString(undefined, {
                        hour: "numeric",
                        minute: "numeric",
                      })}
                    </Typography>
                  ),
                },
                {
                  title: t("Modal_Course_End"),
                  icon: <Papicons.Login />,
                  trailing: (
                    <Typography variant="header">
                      {new Date(endTime * 1000).toLocaleString(undefined, {
                        hour: "numeric",
                        minute: "numeric",
                      })}
                    </Typography>
                  ),
                },
              ],
            },
            {
              title: t("Modal_Course_Details"),
              papicon: <Papicons.Info />,
              items: [
                {
                  papicon: <Papicons.User />,
                  title: t("Modal_Course_Teacher"),
                  description: item.teacher,
                },
                {
                  papicon: <Papicons.MapPin />,
                  title: t("Modal_Course_Room"),
                  description: item.room,
                },
                {
                  papicon: <Papicons.Clock />,
                  title: t("Modal_Course_Duration"),
                  description: formatDistanceStrict(startTime * 1000, endTime * 1000, {
                    locale:
                      DateLocale[i18n.language as keyof typeof DateLocale] ||
                      DateLocale.enUS,
                  }),
                },
              ],
            },
            {
              title: "Notes du cours",
              papicon: <Papicons.Pen />,
              items: [
                {
                  content: notesContent,
                },
              ],
            },
          ]}
          ListHeaderComponent={
            <ModalOverhead
              subject={getSubjectName(item.subject)}
              color={subjectInfo.color}
              subjectVariant="h3"
              date={new Date(startTime * 1000)}
              dateFormat={{
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "numeric",
                minute: "numeric",
              }}
              style={{
                marginBottom: 24,
                marginTop: 24,
              }}
            />
          }
          style={{ backgroundColor: "transparent" }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
