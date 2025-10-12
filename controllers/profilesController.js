import { supabase, supabaseAdmin } from '../clients/supabaseClient.js';

export async function listUsersHandler(req, res) {
  try {
    const client = supabaseAdmin ?? supabase;
    const { data, error } = await client.from('profiles').select('id');
    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    return res.status(200).json({ users: (data || []).map(r => r.id) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

export async function getProfileHandler(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.params.id;

    if (req.user.id !== userId && !supabaseAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const client = supabaseAdmin ?? supabase;
    const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
    if (!data) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({ profile: data });
  } catch (e) {
    console.error('Unexpected error fetching user profile:', e);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}

export async function updateProfileHandler(req, res) {
  try {
    const userId = req.params.id;
    if (req.user.id !== userId && !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });

    const allowed = ['name', 'email', 'skills', 'bio', 'location'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k, v]) => allowed.includes(k) && v !== undefined));
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields provided' });

    const client = supabaseAdmin ?? supabase;
    const { data, error } = await client.from('profiles').update(updates).eq('id', userId).select('*').maybeSingle();

    if (error) {
      console.error('Error updating user profile:', error);
      return res.status(400).json({ error: 'Failed to update profile' });
    }
    if (!data) return res.status(404).json({ error: 'Profile not found' });

    return res.status(200).json({ message: 'Profile updated successfully', profile: data });
  } catch (e) {
    console.error('Unexpected error updating user profile:', e);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  }
}

export async function deleteProfileHandler(req, res) {
  try {
    const userId = req.params.id;
    const client = supabaseAdmin ?? supabase;
    const { data, error } = await client.from('profiles').delete().eq('id', userId);

    if (error) {
      console.error('Error deleting user profile:', error);
      return res.status(400).json({ error: 'Failed to delete profile' });
    }

    return res.status(204).send();
  } catch (e) {
    console.error('Unexpected error deleting user profile:', e);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  }
}