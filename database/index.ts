import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { Absence, Attendance, AttendancePeriod, Delay, Exclusion, Observation, Punishment } from '@/database/models/Attendance';
import CanteenMenu from '@/database/models/CanteenMenu';
import { Chat, Message, Recipient } from '@/database/models/Chat';
import Event from '@/database/models/Event';
import { Grade, Period, PeriodGrades } from '@/database/models/Grades';
import Homework from "@/database/models/Homework";
import Ical from '@/database/models/Ical';
import IntracomBonus from '@/database/models/IntracomBonus';
import IntracomEvent from '@/database/models/IntracomEvent';
import IntracomProfile from '@/database/models/IntracomProfile';
import IntracomRegisteredEvent from '@/database/models/IntracomRegisteredEvent';
import News from '@/database/models/News';
import Subject from '@/database/models/Subject';
import Course from '@/database/models/Timetable';
import CourseNote from '@/database/models/CourseNote';

import migrations from './migrations';
import { Balance } from './models/Balance';
import CanteenHistoryItem from './models/CanteenHistory';
import Kid from './models/Kid';
import SyllabusModel from './models/Syllabus';
import { mySchema } from './schema';

const adapter = new SQLiteAdapter({
  schema: mySchema,
  migrations,
});

export const database = new Database({
  adapter,
  modelClasses: [
    Event,
    Ical,
    Subject,
    Homework,
    News,
    Period,
    Grade,
    PeriodGrades,
    Attendance,
    AttendancePeriod,
    Exclusion,
    Absence,
    Delay,
    Observation,
    Punishment,
    CanteenMenu,
    Chat,
    Message,
    Recipient,
    Course,
    Kid,
    Balance,
    CanteenHistoryItem,
    IntracomEvent,
    IntracomRegisteredEvent,
    IntracomBonus,
    IntracomProfile,
    SyllabusModel,
    CourseNote,
  ],
});
