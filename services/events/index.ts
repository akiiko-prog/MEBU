import { createClient } from '@supabase/supabase-js';
import { MMKV } from 'react-native-mmkv';

const supabaseUrl = 'https://lyfygwcruliolvndudtg.supabase.co';
const supabaseKey = 'sb_publishable_h555Rcq-m-l5dSYk9DVd5Q_ep7c4wi3';

// Persiste la session du compte com (Supabase Auth) entre deux lancements
const authStorage = new MMKV({ id: 'supabase-auth' });

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: {
            getItem: (key: string) => authStorage.getString(key) ?? null,
            setItem: (key: string, value: string) => authStorage.set(key, value),
            removeItem: (key: string) => authStorage.delete(key),
        },
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    },
});

/**
 * Connexion du compte partagé de la communication de l'école. Le compte est
 * créé à la main dans le dashboard Supabase (Authentication > Users) : aucun
 * mot de passe dans le code. Renvoie l'email connecté, ou null si refusé.
 */
export async function signInCom(email: string, password: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
    });

    if (error || !data.user) {
        console.error('[Events] Connexion com refusée:', error);
        return null;
    }
    return data.user.email ?? email.trim();
}

export async function signOutCom(): Promise<void> {
    await supabase.auth.signOut();
}

/** Email du compte com connecté, ou null si aucune session. */
export async function getComEmail(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.email ?? null;
}

export interface SchoolEvent {
    id: string;
    title: string;
    time_start: string;
    time_end: string;
    description: string | null;
    link_url: string | null;
    created_by: string;
    created_at: string;
}

export async function fetchEvents(): Promise<SchoolEvent[]> {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('time_start', { ascending: true });

    if (error) {
        console.error('[Events] Erreur lors de la récupération:', error);
        return [];
    }
    return data || [];
}

export async function createEvent(event: Omit<SchoolEvent, 'id' | 'created_at'>): Promise<SchoolEvent | null> {
    const { data, error } = await supabase
        .from('events')
        .insert([event])
        .select()
        .single();

    if (error) {
        console.error('[Events] Erreur lors de la création:', error);
        return null;
    }
    return data;
}

export async function updateEvent(id: string, updates: Partial<Omit<SchoolEvent, 'id' | 'created_at'>>): Promise<boolean> {
    const { error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id);

    if (error) {
        console.error('[Events] Erreur lors de la modification:', error);
        return false;
    }
    return true;
}

export async function deleteEvent(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Events] Erreur lors de la suppression:', error);
        return false;
    }
    return true;
}