import { supabase, supabaseAdmin } from '../clients/supabaseClient.js';

const admin = supabaseAdmin;

export async function listUserIds() {
  const client = admin ?? supabase;
  return client.from('profiles').select('id');
}

export async function getProfileById(id) {
  const client = admin ?? supabase;
  return client.from('profiles').select('*').eq('id', id).maybeSingle();
}

export async function upsertProfile(profile) {
  const client = admin ?? supabase;
  return client.from('profiles').upsert([profile], { onConflict: 'id' }).select().maybeSingle();
}

export async function updateProfile(id, updates) {
  const client = admin ?? supabase;
  return client.from('profiles').update(updates).eq('id', id).select().maybeSingle();
}

export async function deleteProfile(id) {
  if (!admin) return { data: null, error: { message: 'Admin client required to delete' } };
  return admin.from('profiles').delete().eq('id', id).select();
}