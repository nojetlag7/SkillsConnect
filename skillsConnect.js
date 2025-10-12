import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import profilesRouter from './routes/user.js';
import messagesRouter from './routes/message.js';
import { createClient } from '@supabase/supabase-js';


dotenv.config(); // loading environment variables from .env file

const app = express(); 
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));


app.use('/auth', authRouter);
app.use('/profiles', profilesRouter);
app.use('/messages', messagesRouter);



app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); //showing that app is running on the specified port

/*

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



*/
