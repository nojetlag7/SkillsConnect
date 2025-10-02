import { supabase, supabaseAdmin } from '../clients/supabaseClient.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const client = supabaseAdmin ?? supabase;
    const resp = await client.auth.getUser(token);
    const user = resp?.data?.user ?? null;
    const err = resp?.error ?? null;
    if (err || !user) return res.status(401).json({ error: 'Invalid or expired token' });

    req.user = user;
    next();
  } catch (e) {
    console.error('Auth middleware error:', e);
    return res.status(500).json({ error: 'Auth error' });
  }
}