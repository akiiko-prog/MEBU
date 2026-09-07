// @ts-nocheck
import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class SyllabusModel extends Model {
  static table = 'syllabus';

  @field('syllabusId') syllabusId: string;
  @field('data') data: string; // JSON-serialized Syllabus object
}
