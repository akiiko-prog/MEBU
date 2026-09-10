/**
 * Who is allowed to create calendar events.
 *
 * TO TRANSFER PERMISSIONS TO SOMEONE ELSE:
 * Just add/remove their school login (the same identifier used to log
 * into Auriga/Intracom, e.g. "p.nom@epita.fr") from the list below.
 * No other file needs to change.
 */

export const EVENT_CREATOR_WHITELIST: string[] = [
  "arthaud.delvau@esme.fr",
  // "a.autre@epita.fr",
];

/**
 * Normalizes an identifier before comparison (case/whitespace-insensitive)
 * so "P.Nom@EPITA.fr " and "p.nom@epita.fr" are treated as the same account.
 */
function normalize(identifier: string): string {
  return identifier.trim().toLowerCase();
}

/**
 * Returns true if the given login/email is allowed to create events.
 * Pass in whatever identifier the account uses to authenticate
 * (e.g. the Auriga/Intracom username or email).
 */
export function canCreateEvent(identifier?: string | null): boolean {
  if (!identifier) {
    return false;
  }
  const normalizedId = normalize(identifier);
  return EVENT_CREATOR_WHITELIST.some(
    (allowed) => normalize(allowed) === normalizedId
  );
}
