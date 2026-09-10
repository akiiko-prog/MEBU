import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lyfygwcruliolvndudtg.supabase.co';
const supabaseKey = 'sb_publishable_h555Rcq-m-l5dSYk9DVd5Q_ep7c4wi3';

export const supabase = createClient(supabaseUrl, supabaseKey);

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