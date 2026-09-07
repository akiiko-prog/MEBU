import { Papicons } from '@getpapillon/papicons';
import { useTheme } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { t } from 'i18next';
import React, { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, StyleSheet, TouchableOpacity, UIManager, View } from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Grade, Subject } from '@/services/shared/grade';
import { useAccountStore } from '@/stores/account';
import Typography from '@/ui/components/Typography';
import adjust from '@/utils/adjustColor';
import { getSubjectColor, registerSubjectColor } from '@/utils/subjects/colors';
import { getSubjectName } from '@/utils/subjects/name';
import { getSubjectGroupAverage } from '@/utils/grades/algorithms/subject';
import i18n from '@/utils/i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const expandAnimation = {
  duration: 250,
  create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.scaleY },
  update: { type: LayoutAnimation.Types.easeOut },
  delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.scaleY },
};

const GradeItem = React.memo(({
  grade,
  subjectColor,
  onPress,
  isLast,
  getAvgInfluence,
  getAvgClassInfluence,
}: {
  grade: Grade;
  subjectColor: string;
  onPress: (grade: Grade) => void;
  isLast?: boolean;
  isFirst?: boolean;
  getAvgInfluence: (grade: Grade) => number;
  getAvgClassInfluence: (grade: Grade) => number;
}) => {
  const theme = useTheme();

  const dateString = useMemo(() => {
    if (!grade.givenAt) return '';
    const date = grade.givenAt instanceof Date ? grade.givenAt : new Date(grade.givenAt);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
    });
  }, [grade.givenAt]);

  const handlePress = useCallback(() => {
    requestAnimationFrame(() => onPress(grade));
  }, [grade, onPress]);

  const hasMaxScore =
    grade.studentScore?.value === grade.maxScore?.value && !grade.studentScore?.disabled;
  const badgeBg = hasMaxScore
    ? adjust(subjectColor, theme.dark ? -0.2 : 0)
    : adjust(subjectColor, theme.dark ? -0.85 : 0.88);
  const badgeFg = hasMaxScore ? '#FFFFFF' : subjectColor;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[
        styles.gradeRow,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.gradeRowText}>
        <Typography
          variant="title"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={styles.gradeTitle}
        >
          {grade.description || t('Grade_NoDescription', { subject: '' })}
        </Typography>
        <Typography variant="body2" color="secondary" style={styles.gradeDate}>
          {dateString}
        </Typography>
      </View>

      <View style={[styles.gradeBadge, { backgroundColor: badgeBg }]}>
        {grade.alphaMark ? (
          <Typography style={[styles.badgeScore, { color: badgeFg }]}>
            {grade.alphaMark === 'VA'
              ? 'Val.'
              : grade.alphaMark === 'NV'
                ? 'N.Val.'
                : grade.alphaMark}
          </Typography>
        ) : grade.studentScore?.disabled ? (
          <Typography style={[styles.badgeScore, { color: badgeFg }]}>
            {grade.studentScore?.status}
          </Typography>
        ) : (
          <>
            <Typography style={[styles.badgeScore, { color: badgeFg }]}>
              {(grade.studentScore?.value ?? 0).toFixed(2)}
            </Typography>
            <Typography style={[styles.badgeOutOf, { color: badgeFg + 'AA' }]}>
              /{grade.outOf?.value ?? 20}
            </Typography>
          </>
        )}
        {hasMaxScore && (
          <Papicons
            name="crown"
            color={badgeFg}
            size={14}
            style={{ marginLeft: 3, marginBottom: 2 }}
          />
        )}
      </View>
    </TouchableOpacity>
  );
});

export const SubjectItem: React.FC<{
  subject: Subject;
  grades: Grade[];
  getAvgInfluence: (grade: Grade) => number;
  getAvgClassInfluence: (grade: Grade) => number;
  parentBgColor?: string;
  isUE?: boolean;
}> = React.memo(({ subject, grades, getAvgInfluence, getAvgClassInfluence, parentBgColor, isUE = false }) => {
  const theme = useTheme();
  const navigation = useNavigation();

  const baseColor = useMemo(() => getSubjectColor(subject.name), [subject.name]);

  React.useEffect(() => {
    const store = useAccountStore.getState();
    const lastAcc = store.lastUsedAccount;
    const existing = store.accounts.find((a: any) => a.id === lastAcc)?.customisation?.subjects?.[subject.name]?.color;
    if (!existing) {
      registerSubjectColor(subject.name);
    }
  }, [subject.name]);

  const subjectAdjustedColor = useMemo(
    () => adjust(baseColor, theme.dark ? 0.2 : -0.4),
    [baseColor, theme.dark]
  );
  const headerBg = useMemo(
    () => adjust(baseColor, theme.dark ? -0.85 : 0.88),
    [baseColor, theme.dark]
  );

  // Nested radius rule: inner = outer - padding
  const isNested = !!parentBgColor;
  const containerRadius = isNested ? 15 : 20; // 20 - 5 (ueChildrenContainer padding) = 15

  const subjectName = useMemo(
    () => getSubjectName(subject.name) || subject.name,
    [subject.name]
  );

  const handlePressSubject = useCallback(() => {
    // @ts-expect-error navigation types
    navigation.navigate('(modals)/subject-info', { subject });
  }, [navigation, subject]);

  const handlePressGrade = useCallback(
    (grade: Grade) => {
      // @ts-expect-error navigation types
      navigation.navigate('(modals)/grade', {
        grade,
        subjectInfo: {
          name: subjectName,
          color: subjectAdjustedColor,
          originalName: subject.name,
        },
        avgInfluence: getAvgInfluence(grade),
        avgClass: getAvgClassInfluence(grade),
      });
    },
    [navigation, subjectName, subjectAdjustedColor, subject.name, grades]
  );

  const computedAverage = useMemo(() => getSubjectGroupAverage(subject), [subject]);
  const displayAverage = computedAverage !== -1 ? computedAverage : subject.studentAverage.value;

  const hasGrades = (subject.grades?.length ?? 0) > 0;
  const hasSubjects = !!subject.subjects?.length;
  const hasChildren = hasGrades || hasSubjects;

  const UEList = ['Agir', 'Concevoir', 'Produire', 'Projet', 'Piloter', 'Cahier des Spécifications Fonctionnel', 'Stage Ouvrier', 'Mathématiques et Informatique Fondamentales', 'Mathématiques et Informatique Avancées', 'Ingénierie des Sciences du Numériques - LANGAGES', 'Cybersécurité (techniques et outils)', 'Ingénierie des Sciences du Numériques - BASES', 'Sciences Humaines, Sociales, Juridiques et de Communication', 'Concevoir une campagne de sensibilisation aux enjeux de sécurité', 'Développer un jeu ou un outil', 'Rapport de stage', 'Initiation à la démarche de la recherche'];
  const isUELevel = UEList.includes(subjectName);

  const [expanded, setExpanded] = useState(true);
  const chevronRotation = useSharedValue(1);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(expandAnimation);
    const next = !expanded;
    setExpanded(next);
    chevronRotation.value = withTiming(next ? 1 : 0, { duration: 250, easing: Easing.out(Easing.cubic) });
  }, [expanded, chevronRotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));

  if (isUELevel) {
    return (
      <View style={[styles.ueContainer, { borderColor: theme.colors.text + '18', backgroundColor: theme.dark ? theme.colors.card : '#00000006' }]}>
        <View style={styles.ueHeader}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handlePressSubject}
            style={styles.subjectHeaderContent}
          >
            <Typography
              numberOfLines={1}
              ellipsizeMode="tail"
              variant="header"
              style={[styles.ueTitle, { color: subjectAdjustedColor }]}
            >
              {subjectName.toUpperCase()}
            </Typography>

            <View style={[styles.averageBadge, { backgroundColor: theme.colors.card }]}>
              {subject.isValidationOnly ? (
                <Typography style={[styles.avgScore, { color: subjectAdjustedColor }]}>
                  {subject.hasNonValidated ? 'N.Val.' : 'Val.'}
                </Typography>
              ) : subject.studentAverage.disabled ? (
                <Typography style={[styles.avgScore, { color: subjectAdjustedColor }]}>
                  {subject.studentAverage.status}
                </Typography>
              ) : (
                <Typography style={[styles.avgScore, { color: subjectAdjustedColor }]}>
                  {displayAverage.toFixed(1)}
                </Typography>
              )}
            </View>
          </TouchableOpacity>

          {hasChildren && (
            <TouchableOpacity
              onPress={toggleExpanded}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.chevronButton}
            >
              <Reanimated.View style={chevronStyle}>
                <Papicons name="ChevronDown" size={18} color={subjectAdjustedColor + 'AA'} />
              </Reanimated.View>
            </TouchableOpacity>
          )}
        </View>

        {hasSubjects && expanded && (
          <View style={styles.ueChildrenContainer}>
            {subject.subjects!.map((sub, index) => (
              <SubjectItem
                key={sub.id}
                subject={sub}
                grades={grades}
                getAvgInfluence={getAvgInfluence}
                getAvgClassInfluence={getAvgClassInfluence}
                parentBgColor={headerBg}
              />
            ))}
          </View>
        )}
      </View>
    );
  }
  return (
    <View
      style={[
        styles.ecueContainer,
        { backgroundColor: headerBg, borderColor: theme.colors.text + '18', borderRadius: containerRadius, borderWidth: isNested ? 0 : StyleSheet.hairlineWidth },
        !expanded && hasChildren && { borderRadius: containerRadius },
      ]}
    >
      <View style={styles.ecueHeader}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handlePressSubject}
          style={styles.subjectHeaderContent}
        >
          <Typography
            numberOfLines={1}
            ellipsizeMode="tail"
            variant="title"
            style={[styles.ecueTitle, { color: subjectAdjustedColor }]}
          >
            {subjectName || '?'}
          </Typography>
          <View style={[styles.averageBadge, { backgroundColor: theme.colors.card }]}>
            {subject.isValidationOnly ? (
              <Typography style={[styles.avgScore, { color: subjectAdjustedColor }]}>
                {subject.hasNonValidated ? 'N.Val.' : 'Val.'}
              </Typography>
            ) : subject.studentAverage.disabled ? (
              <Typography style={[styles.avgScore, { color: subjectAdjustedColor }]}>
                {subject.studentAverage.status}
              </Typography>
            ) : (
              <Typography style={[styles.avgScore, { color: subjectAdjustedColor }]}>
                {displayAverage.toFixed(2)}
              </Typography>
            )}
          </View>
        </TouchableOpacity>

        {hasChildren && (
          <TouchableOpacity
            onPress={toggleExpanded}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.chevronButton}
          >
            <Reanimated.View style={chevronStyle}>
              <Papicons name="ChevronDown" size={18} color={subjectAdjustedColor + 'AA'} />
            </Reanimated.View>
          </TouchableOpacity>
        )}
      </View>

      {!hasSubjects && hasGrades && expanded && (
        <View style={[styles.gradesCard, { borderColor: theme.colors.border }]}>
          {subject.grades!.map((grade, index) => (
            <GradeItem
              key={grade.id}
              grade={grade}
              subjectColor={subjectAdjustedColor}
              onPress={handlePressGrade}
              getAvgInfluence={getAvgInfluence}
              getAvgClassInfluence={getAvgClassInfluence}
              isFirst={index === 0}
              isLast={index === (subject.grades?.length ?? 0) - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  // UE
  ueContainer: {
    width: '100%',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  ueTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  ueChildrenContainer: {
    paddingHorizontal: 5,
    paddingBottom: 5,
    gap: 5,
  },

  // ECUE
  ecueContainer: {
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ecueContainerClosed: {},
  ecueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  ecueTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },

  // Shared
  subjectHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chevronButton: {
    padding: 4,
  },
  averageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 30,
    gap: 1,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  avgScore: {
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 20,
  },

  // Grades card
  gradesCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 15,
  },
  gradeRowText: {
    flex: 1,
    gap: 3,
  },
  gradeTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  gradeDate: {
    fontSize: 13,
  },
  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 1,
  },
  badgeScore: {
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 20,
  },
  badgeOutOf: {
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 1,
  },
});

GradeItem.displayName = 'GradeItem';
SubjectItem.displayName = 'SubjectItem';