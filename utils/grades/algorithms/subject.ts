import { Grade, Subject } from "@/services/shared/grade";

import { ScoreProperty } from "./helpers";

export const getSubjectAverage = (
  subject: Grade[],
  loop: boolean = false,
  key: ScoreProperty = "studentScore"
): number => {
  let calcGradesSum = 0;
  let calcOutOfSum = 0;
  let upgrading = null;

  for (let i = 0; i < subject.length; i++) {
    const grade = subject[i];
    if (String(grade._gradeCode).includes("RATT")) {
      upgrading = grade;
      continue;
    }
    if (
      grade._isSAE || // SAE projects are pass/fail, never counted in a /20 average
      !grade[key] ||
      grade[key].disabled ||
      grade[key].value === null ||
      grade[key].value < 0 ||
      grade.coefficient === 0 ||
      typeof grade[key].value !== "number" ||
      !grade.outOf?.value
    ) {
      continue;
    }

    const coefficient = grade.coefficient || 1;
    const outOfValue = grade.outOf.value;
    const gradeValue = grade[key].value;

    if (grade.optional && !loop) {
      const filteredSubject = subject.filter((_, idx) => idx !== i);
      const avgWithout = getSubjectAverage(filteredSubject, true, key);
      const avgWith = getSubjectAverage(subject, true, key);

      if (avgWithout > avgWith) {
        continue;
      }
    }

    if (grade.bonus) {
      const averageMoy = outOfValue / 2;
      const newGradeValue = gradeValue - averageMoy;

      if (newGradeValue >= 0) {
        calcGradesSum += newGradeValue;
        calcOutOfSum += 1;
      }
      continue;
    }

    if (gradeValue > 20 || (coefficient < 1 && outOfValue - 20 >= -5) || outOfValue > 20) {
      const gradeOn20 = (gradeValue / outOfValue) * 20;
      calcGradesSum += gradeOn20 * coefficient;
      calcOutOfSum += 20 * coefficient;
    } else {
      calcGradesSum += gradeValue * coefficient;
      calcOutOfSum += outOfValue * coefficient;
    }
  }
  if (calcOutOfSum > 0) {
    let result = Math.min((calcGradesSum / calcOutOfSum) * 20, 20);
    result = upgrading?.studentScore?.value && upgrading?.studentScore?.value > result ? upgrading?.studentScore?.value : result;
    return isNaN(result) ? -1 : result;
  }

  return -1;
};


export const getSubjectGroupAverage = (subject: Subject): number => {
  let totalAverage = 0;
  let totalCoeff = 0;

  if (subject.subjects && subject.subjects.length > 0) {
    for (const subSubject of subject.subjects) {
      const average = getSubjectGroupAverage(subSubject);
      if (average !== -1) {
        const coeff = subSubject._syllabusCoeff ?? 1;
        totalAverage += average * coeff;
        totalCoeff += coeff;
      }
    }
  }

  if (totalCoeff === 0 && subject.grades && subject.grades.length > 0) {
    return getSubjectAverage(subject.grades);
  }

  if (totalCoeff > 0) {
    return totalAverage / totalCoeff;
  }

  return -1;
};

const PapillonSubjectAvg = (grades: Grade[], key: ScoreProperty = "studentScore"): number => {
  if (!grades?.length) {
    return 0;
  }

  const groupedBySubject: Record<string, Grade[]> = {};
  let countedSubjects = 0;
  let totalAverage = 0;

  // Group grades by subject
  for (let i = 0; i < grades.length; i++) {
    const grade = grades[i];
    const key = grade.subjectId;
    if (!groupedBySubject[key]) {
      groupedBySubject[key] = [];
    }
    groupedBySubject[key].push(grade);
  }

  const subjects = Object.values(groupedBySubject);

  // Calculate average for each subject
  for (let i = 0; i < subjects.length; i++) {
    const nAvg = getSubjectAverage(subjects[i], false, key);
    if (nAvg !== -1) {
      countedSubjects++;
      totalAverage += nAvg;
    }
  }

  return countedSubjects > 0 ? totalAverage / countedSubjects : 0;
};

export default PapillonSubjectAvg;