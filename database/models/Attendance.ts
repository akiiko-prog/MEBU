// eslint-disable-next-line @typescript-eslint/ban-ts-comment
import { Model } from '@nozbe/watermelondb';
import { children, field, relation } from '@nozbe/watermelondb/decorators';

export class Attendance extends Model {
  static table = "attendance";
  static associations = {
    delays: { type: 'has_many', foreignKey: 'attendanceId' },
    absences: { type: 'has_many', foreignKey: 'attendanceId' },
    observations: { type: 'has_many', foreignKey: 'attendanceId' },
    punishments: { type: 'has_many', foreignKey: 'attendanceId' },
  };
  @field('createdByAccount') createdByAccount: string;
  @field('period') period: string;
  @field('kidName') kidName: string;
  @field('attendanceId') attendanceId: string;
  @children('delays') delays: Query<Delay>;
  @children('absences') absences: Query<Absence>;
  @children('observations') observations: Query<Observation>;
  @children('punishments') punishments: Query<Punishment>;
}

export class AttendancePeriod extends Model {
  static table = "attendance_periods";

  static associations = {
    attendance: { type: 'belongs_to', key: 'attendanceId' },
    absences: { type: 'has_many', foreignKey: 'periodId' },
    exclusions: { type: 'has_many', foreignKey: 'periodId' },
  };

  @field('periodId') periodId: number;
  @field('points') points: number;
  @field('grade') grade: number;
  @field('beginDate') beginDate: string;
  @field('endDate') endDate: string;
  @field('attendanceId') attendanceId: string;

  @relation('attendance', 'attendanceId') attendance: Attendance;
  @children('absences') absences: Query<Absence>;
  @children('exclusions') exclusions: Query<Exclusion>;
}

export class Absence extends Model {
  static table = "absences";

  static associations = {
    attendance: { type: 'belongs_to', key: 'attendanceId' },
  } as const;

  @field('from') from: number;
  @field('to') to: number;
  @field('reason') reason?: string;
  @field('justified') justified: boolean;
  @field('attendanceId') attendanceId: string;
  @field('kidName') kidName?: string;
  @field('slotId') slotId?: string;
  @field('subjectName') subjectName?: string;
  @field('mandatory') mandatory?: boolean;

  @relation('attendance', 'attendanceId') attendanceParent: Attendance;
}

export class Exclusion extends Model {
  static table = "exclusions";

  static associations = {
    attendance_periods: { type: 'belongs_to', key: 'periodId' },
  } as const;

  @field('periodId') periodId: string;
  @relation('attendance_periods', 'periodId') period: AttendancePeriod;
}

export class Delay extends Model {
  static table = 'delays';
  
  static associations = {
    attendance: { type: 'belongs_to', key: 'attendanceId' },
  } as const;
  
  @field('givenAt') givenAt: number;
  @field('duration') duration: number;
  @field('reason') reason?: string;
  @field('justified') justified: boolean;
  @field('attendanceId') attendanceId: string;
  
  @relation('attendance', 'attendanceId') attendance: Attendance;
}

export class Observation extends Model {
  static table = 'observations';
  
  static associations = {
    attendance: { type: 'belongs_to', key: 'attendanceId' },
  } as const;
  
  @field('givenAt') givenAt: number;
  @field('sectionName') sectionName: string;
  @field('sectionType') sectionType: string;
  @field('subjectName') subjectName?: string;
  @field('shouldParentsJustify') shouldParentsJustify: boolean;
  @field('reason') reason?: string;
  @field('attendanceId') attendanceId: string;

  @relation('attendance', 'attendanceId') attendance: Attendance;
}

export class Punishment extends Model {
  static table = 'punishments';
  
  static associations = {
    attendance: { type: 'belongs_to', key: 'attendanceId' },
  } as const;
  
  @field('givenAt') givenAt: number;
  @field('givenBy') givenBy: string;
  @field('exclusion') exclusion: boolean;
  @field('duringLesson') duringLesson: boolean;
  @field('nature') nature: string;
  @field('duration') duration: number;
  @field('homeworkDocumentsRaw') homeworkDocumentsRaw: string;
  @field('reasonDocumentsRaw') reasonDocumentsRaw: string;
  @field('homeworkText') homeworkText?: string;
  @field('reasonText') reasonText?: string;
  @field('reasonCircumstances') reasonCircumstances?: string;
  @field('attendanceId') attendanceId: string;

  @relation('attendance', 'attendanceId') attendance: Attendance;
}
