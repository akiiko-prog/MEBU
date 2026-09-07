import { useDatabase } from '@/database/DatabaseProvider';
import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';
import CourseNote from '@/database/models/CourseNote';

export function useCourseNotes(courseId: string) {
    const db = useDatabase();
    const [notes, setNotes] = useState<CourseNote[]>([]);

    useEffect(() => {
        const subscription = db.get<CourseNote>('course_notes')
            .query(Q.where('courseId', courseId))
            .observe()
            .subscribe(setNotes);
        return () => subscription.unsubscribe();
    }, [courseId]);

    const addNote = async (content: string, accountId: string) => {
        await db.write(async () => {
            await db.get<CourseNote>('course_notes').create(note => {
                note.courseId = courseId;
                note.content = content;
                note.createdAt = Date.now();
                note.createdByAccount = accountId;
            });
        });
    };

    const deleteNote = async (noteId: string) => {
        await db.write(async () => {
            const n = await db.get<CourseNote>('course_notes').find(noteId);
            await n.destroyPermanently();
        });
    };

    return { notes, addNote, deleteNote };
}
