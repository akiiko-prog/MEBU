// @ts-nocheck
import { Model } from '@nozbe/watermelondb';
import { field } from "@nozbe/watermelondb/decorators";

export default class CourseNote extends Model {
  static table = 'course_notes';

  @field('courseId') courseId: string;
  @field('content') content: string;
  @field('createdAt') createdAt: number;
  @field('createdByAccount') createdByAccount: string;
}
