import { supabase } from '../clients/supabaseClient.js';
import { supabaseAdmin } from '../clients/supabaseClient.js';

export async function signupHandler(req, res) {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const signUpResp = await supabase.auth.signUp({ email, password });
    const signUpError = signUpResp?.error ?? null;
    const user = signUpResp?.data?.user ?? signUpResp?.user ?? null;

    if (signUpError) {
      console.error('Signup error:', signUpError);
      return res.status(400).json({ error: signUpError.message ?? String(signUpError) });
    }

    const userId = user?.id ?? null;
    if (!userId) {
      console.error('Signup returned no user id');
      return res.status(500).json({ error: 'Signup succeeded but no user id returned' });
    }

    // create profile server-side BEFORE responding; use admin client if available
    const nameValue = (typeof full_name === 'string' && full_name.trim()) ? full_name.trim() : '';
    try {
      const client = supabaseAdmin ?? supabase;
      const { error: profileError } = await client
        .from('profiles')
        .upsert([{ id: userId, email, name: nameValue }], { onConflict: 'id' });
      if (profileError) console.error('Error inserting profile:', profileError);
    } catch (e) {
      console.error('Error inserting profile:', e);
    }

    return res.status(201).json({ message: 'Signup successful', userId });
  } catch (e) {
    console.error('Signup error:', e);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

export async function loginHandler(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Login error:', error);
      return res.status(400).json({ error: error.message ?? String(error) });
    }

    return res.status(200).json({
      message: 'Login successful',
      user: data?.user ?? null,
      session: data?.session ?? null
    });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}