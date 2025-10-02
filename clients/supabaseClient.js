import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config(); // load .env for client construction

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

// to bypass RLS for server-side operations (only if SERVICE ROLE KEY present)
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

if(!supabaseAdmin) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set. supabaseAdmin client will not be created.');
}