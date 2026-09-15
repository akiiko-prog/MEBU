import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'grade-cache' });
const KEY = 'seen_grade_ids';

/**
 * Returns the set of grade IDs we've already notified about.
 */
export function getSeenGradeIds(): Set<string> {
    const raw = storage.getString(KEY);
    if (!raw) return new Set();
    try {
        return new Set(JSON.parse(raw) as string[]);
    } catch {
        return new Set();
    }
}

/**
 * Persists an updated set of seen grade IDs.
 */
export function saveSeenGradeIds(ids: Set<string>): void {
    storage.set(KEY, JSON.stringify(Array.from(ids)));
}

/**
 * Returns grade IDs that are in `incoming` but not in `seen`.
 */
export function diffGradeIds(incoming: string[], seen: Set<string>): string[] {
    return incoming.filter((id) => !seen.has(id));
}
