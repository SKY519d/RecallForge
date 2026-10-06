import type { AppData } from '../../types';
import { parseBackup } from '../storage/localStorage';
import { supabase } from './supabase';

function getClient() {
  if (!supabase) throw new Error('Account storage is not configured. Add the Supabase URL and public key, then restart the app.');
  return supabase;
}

export async function loadCloudWorkspace(userId: string): Promise<AppData | null> {
  const { data, error } = await getClient()
    .from('user_workspaces')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load your account data: ${error.message}`);
  return data ? parseBackup(data.data) : null;
}

export async function saveCloudWorkspace(userId: string, data: AppData): Promise<void> {
  const { error } = await getClient()
    .from('user_workspaces')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error(`Could not sync your account data: ${error.message}`);
}
