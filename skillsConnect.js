import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createClient } from '@supabase/supabase-js';


dotenv.config(); // loading environment variables from .env file

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
//to bypass RLS for server-side operations
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

if(!supabaseAdmin) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set. supabaseAdmin client will not be created.');
}
//the above is done to ensure that supabaseAdmin is only created if the service role key is available

const app = express(); 
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));



//simple signup route with create auth user and profile
app.post('/auth/signup', async (req, res) => {
    try{
        const { email, password } = req.body;

        //some simple validation
        if(!email || !password){
            return res.status(400).json({ error: 'Email and password are required' });
        }
        else if(password.length < 6){
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        else if(!email.includes('@') || !email.includes('.')){
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const { data, error } = await supabase.auth.signUp({ email, password });
        //use data.user to get user info like id, email, etc.
        //use data.session to get session info like access_token, refresh_token, etc.


        if (error) {
            console.error('Signup error:', error);
            return res.status(400).json({ error: error.message });
        }
        
        const userId = data.user.id;
        try{
            const {error} = await supabaseAdmin
                .from('profiles')
                .upsert([{ id: userId, email }], { onConflict: 'id' });

            if(error){
                console.error('Error inserting profile:', error);
            }
        }
        catch(e){
            console.error('Error inserting profile:', e);
        }

        //responding with success message and user data 
        // NB 200 -> OK but 201 -> Created is more appropriate for signup
        res.status(201).json({
            message: 'Signup successful, please check your email to confirm your account.',
            user: data.user.id
        });

    } catch(error){   
        console.error('Unexpected error during signup:', error);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});

//simple login route
app.post('/auth/login', async (req, res) => {
    try{
        const { email, password } = req.body;
        if(!email || !password){
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            console.error('Login error:', error);
            return res.status(400).json({ error: error.message });
        }

        //responding with success message and user data
        res.status(200).json(
            { message: 'Login successful.',
                user: data.user,
                access_token: data.session?.access_token
            });
    }

    catch(error){
        console.error('Unexpected error during login:', error);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});


//authentication middleware

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies?.access_token;
        if (!token) return res.status(401).json({ error: 'Missing auth token' });

        // prefer admin client for getUser if available (works with service role)
        const client = supabaseAdmin ?? supabase;
        const resp = await client.auth.getUser(token);
        //getting the user associated with the token by decoding the JWT token
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

//get all users
app.get('/users', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('*');

        if (error) {
            console.error('Error fetching users:', error);
            return res.status(400).json({ error: 'Failed to fetch users' });
        }

        res.status(200).json({ users: data.map(user => user.id) });
    } catch (e) {
        console.error('Unexpected error fetching users:', e);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});

//read user profile
app.get('/profile/:id', authenticate, async (req, res) => {
    try {
        if(!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const userId = req.params.id;

        if (req.user.id !== userId && !supabaseAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // using admin client when available to bypass RLS
        const client = supabaseAdmin ?? supabase;

        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching user profile:', error);
            return res.status(404).json({ error: 'User not found' });
        }
        if (!data) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ profile: data });
    } catch (e) {
        console.error('Unexpected error fetching user profile:', e);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});

//update user profile
app.put('/profile/:id', authenticate, async (req, res) => {
    try {
        const userId = req.params.id;

        // allow only owner or admin
        if (req.user.id !== userId && !supabaseAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // build updates from allowed keys present in body
        const allowed = ['name', 'email', 'skills', 'bio', 'location'];
        const updates = Object.fromEntries(
            Object.entries(req.body).filter(([k, v]) => allowed.includes(k) && v !== undefined)
        );

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updatable fields provided' });
        }

        const client = supabaseAdmin ?? supabase;
        const { data, error } = await client
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select('*')         // explicitly request all columns
            .maybeSingle();      // avoid throwing if zero rows

        if (error) {
            console.error('Error updating user profile:', error);
            return res.status(400).json({ error: 'Failed to update profile' });
        }

        if (!data) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // return the updated profile (or use 204 if you prefer no body)
        return res.status(200).json({ message: 'Profile updated successfully', profile: data });
    } catch (e) {
        console.error('Unexpected error updating user profile:', e);
        return res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});

//delete user profile
app.delete('/profile/:id', authenticate, async (req, res) => {
    try {
        const userId = req.params.id;
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (error) {
            console.error('Error deleting user profile:', error);
            return res.status(400).json({ error: 'Failed to delete profile' });
        }

        res.status(204).send();
    } catch (e) {
        console.error('Unexpected error deleting user profile:', e);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});

// convos and messages

// create or get existing conversation between the authenticated user and a peer
app.post('/conversations', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { peer_id } = req.body;
        if (!peer_id) return res.status(400).json({ error: 'peer_id is required' });
        if (peer_id === userId) return res.status(400).json({ error: 'Cannot create conversation with yourself' });

        // Find existing conversation in either user1/user2 order
        const { data: existing, error: findErr } = await supabaseAdmin
            .from('conversations')
            .select('*')
            .or(`and(user1_id.eq.${userId},user2_id.eq.${peer_id}),and(user1_id.eq.${peer_id},user2_id.eq.${userId})`)
            .maybeSingle();

        if (findErr) {
            console.error('Find conversation error:', findErr);
            return res.status(500).json({ error: 'Failed to lookup conversation' });
        }
        if (existing) return res.status(200).json({ conversation: existing });

        // Create new conversation (use canonical ordering optional; DB unique constraint should prevent dupes)
        const { data: created, error: createErr } = await supabaseAdmin
            .from('conversations')
            .insert([{ user1_id: userId, user2_id: peer_id }])
            .select('*')
            .single();

        if (createErr) {
            console.error('Create conversation error:', createErr);
            return res.status(500).json({ error: 'Failed to create conversation' });
        }
        return res.status(201).json({ conversation: created });
    } catch (e) {
        console.error('Unexpected error creating conversation:', e);
        return res.status(500).json({ error: 'Unexpected error' });
    }
});

// list conversations for the authenticated user
app.get('/conversations', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { data, error } = await supabaseAdmin
            .from('conversations')
            .select('*')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
        if (error) {
            console.error('List conversations error:', error);
            return res.status(500).json({ error: 'Failed to list conversations' });
        }
        return res.status(200).json({ conversations: data || [] });
    } catch (e) {
        console.error('Unexpected error listing conversations:', e);
        return res.status(500).json({ error: 'Unexpected error' });
    }
});

// send a message; accept either conversation_id or peer_id (auto-create conversation)
app.post('/messages', authenticate, async (req, res) => {
    try {
        const senderId = req.user.id;
        const { conversation_id, peer_id, text } = req.body;
        if (!text || typeof text !== 'string' || text.trim() === '') {
            return res.status(400).json({ error: 'text is required' });
        }

        let convId = conversation_id;
        // If peer_id provided, find or create conversation
        if (!convId && peer_id) {
            const { data: existing, error: findErr } = await supabaseAdmin
                .from('conversations')
                .select('*')
                .or(`and(user1_id.eq.${senderId},user2_id.eq.${peer_id}),and(user1_id.eq.${peer_id},user2_id.eq.${senderId})`)
                .maybeSingle();
            if (findErr) {
                console.error('Find conversation for message error:', findErr);
                return res.status(500).json({ error: 'Failed to resolve conversation' });
            }
            if (existing) {
                convId = existing.id;
            } else {
                const { data: created, error: createErr } = await supabaseAdmin
                    .from('conversations')
                    .insert([{ user1_id: senderId, user2_id: peer_id }])
                    .select('*')
                    .single();
                if (createErr) {
                    console.error('Create conversation for message error:', createErr);
                    return res.status(500).json({ error: 'Failed to create conversation' });
                }
                convId = created.id;
            }
        }

        if (!convId) return res.status(400).json({ error: 'conversation_id or peer_id is required' });

        // Ensure sender is participant of the conversation
        const { data: conv, error: convErr } = await supabaseAdmin
            .from('conversations')
            .select('id,user1_id,user2_id')
            .eq('id', convId)
            .maybeSingle();
        if (convErr) {
            console.error('Verify conversation error:', convErr);
            return res.status(500).json({ error: 'Failed to verify conversation' });
        }
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
        if (conv.user1_id !== senderId && conv.user2_id !== senderId) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        // Insert message (timestamp column name follows assignment: 'timestamp')
        const { data: msg, error: msgErr } = await supabaseAdmin
            .from('messages')
            .insert([{ conversation_id: convId, sender_id: senderId, text }])
            .select('*')
            .single();
        if (msgErr) {
            console.error('Send message error:', msgErr);
            return res.status(500).json({ error: 'Failed to send message' });
        }
        return res.status(201).json({ message: msg });
    } catch (e) {
        console.error('Unexpected error sending message:', e);
        return res.status(500).json({ error: 'Unexpected error' });
    }
});

// fetch messages in a conversation with pagination (newest-first)
app.get('/messages', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversation_id, limit = 20, before } = req.query;
        if (!conversation_id) return res.status(400).json({ error: 'conversation_id is required' });

        // Verify membership
        const { data: conv, error: convErr } = await supabaseAdmin
            .from('conversations')
            .select('id,user1_id,user2_id')
            .eq('id', conversation_id)
            .maybeSingle();
        if (convErr) {
            console.error('Verify conversation error:', convErr);
            return res.status(500).json({ error: 'Failed to verify conversation' });
        }
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
        if (conv.user1_id !== userId && conv.user2_id !== userId) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        let query = supabaseAdmin
            .from('messages')
            .select('*')
            .eq('conversation_id', conversation_id)
            .order('timestamp', { ascending: false });

        if (before) {
            query = query.lt('timestamp', before);
        }

        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        query = query.limit(parsedLimit);

        const { data, error } = await query;
        if (error) {
            console.error('Fetch messages error:', error);
            return res.status(500).json({ error: 'Failed to fetch messages' });
        }
        return res.status(200).json({ messages: data || [] });
    } catch (e) {
        console.error('Unexpected error fetching messages:', e);
        return res.status(500).json({ error: 'Unexpected error' });
    }
});

//API-level realtime listener using Server-Sent Events (clients still can subscribe directly to Supabase)
app.get('/realtime/messages', authenticate, async (req, res) => {
    try {
        const { conversation_id } = req.query;
        if (!conversation_id) return res.status(400).json({ error: 'conversation_id is required' });

        // Verify membership before opening stream
        const userId = req.user.id;
        const { data: conv, error: convErr } = await supabaseAdmin
            .from('conversations')
            .select('id,user1_id,user2_id')
            .eq('id', conversation_id)
            .maybeSingle();
        if (convErr) {
            console.error('Verify conversation error:', convErr);
            return res.status(500).json({ error: 'Failed to verify conversation' });
        }
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
        if (conv.user1_id !== userId && conv.user2_id !== userId) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        // Setup SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        // Subscribe to Supabase Realtime for inserts on messages for this conversation
        const channel = supabase.channel(`messages:${conversation_id}`);
        channel.on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversation_id}`
        }, (payload) => {
            const data = JSON.stringify(payload.new);
            res.write(`event: message\n`);
            res.write(`data: ${data}\n\n`);
        }).subscribe();

        // Heartbeat to keep connection alive (every 25s)
        const interval = setInterval(() => {
            res.write(': ping\n\n');
        }, 25000);

        req.on('close', () => {
            clearInterval(interval);
            channel.unsubscribe();
            res.end();
        });
    } catch (e) {
        console.error('Realtime SSE error:', e);
        return res.status(500).json({ error: 'Unexpected error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); //showing that app is running on the specified port

