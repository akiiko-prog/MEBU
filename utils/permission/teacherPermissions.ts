/**
 * Who is allowed to use MEBU in teacher mode (timetable, events and links
 * only, no grades or absences).
 *
 * TO ADD OR REMOVE A TEACHER:
 * Just add/remove their school login (the same identifier used to log
 * into Auriga, e.g. "p.nom@esme.fr") from the list below.
 * No other file needs to change.
 *
 * The list is strict both ways: a whitelisted account can only sign in as
 * a teacher, and any other account can only sign in as a student.
 */

export const TEACHER_WHITELIST: string[] = [
];

/**
 * Normalizes an identifier before comparison (case/whitespace-insensitive)
 * so "P.Nom@ESME.fr " and "p.nom@esme.fr" are treated as the same account.
 */
function normalize(identifier: string): string {
  return identifier.trim().toLowerCase();
}

/**
 * Returns true if the given login/email belongs to a whitelisted teacher.
 * Pass in the Auriga username used to authenticate.
 */
export function isTeacherAccount(identifier?: string | null): boolean {
  if (!identifier) {
    return false;
  }
  const normalizedId = normalize(identifier);
  return TEACHER_WHITELIST.some(
    (allowed) => normalize(allowed) === normalizedId
  );
}
