import { supabase, supabaseAdmin } from '../clients/supabaseClient.js';

// POST /conversations
export async function createConversationHandler(req, res) {
	try {
		const userId = req.user.id;
		const { peer_id } = req.body;
		if (!peer_id) return res.status(400).json({ error: 'peer_id is required' });
		if (peer_id === userId) return res.status(400).json({ error: 'Cannot create conversation with yourself' });

		const db = supabaseAdmin ?? supabase;

		// Find existing conversation in either user1/user2 order
		const { data: existing, error: findErr } = await db
			.from('conversations')
			.select('*')
			.or(`and(user1_id.eq.${userId},user2_id.eq.${peer_id}),and(user1_id.eq.${peer_id},user2_id.eq.${userId})`)
			.maybeSingle();

		if (findErr) {
			console.error('Find conversation error:', findErr);
			return res.status(500).json({ error: 'Failed to lookup conversation' });
		}
		if (existing) return res.status(200).json({ conversation: existing });

		// Create new conversation
		const { data: created, error: createErr } = await db
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
}

// GET /conversations
export async function listConversationsHandler(req, res) {
	try {
		const userId = req.user.id;
		const db = supabaseAdmin ?? supabase;
		const { data, error } = await db
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
}

// POST /messages
export async function sendMessageHandler(req, res) {
	try {
		const senderId = req.user.id;
		const { conversation_id, peer_id, text } = req.body;
		if (!text || typeof text !== 'string' || text.trim() === '') {
			return res.status(400).json({ error: 'text is required' });
		}

		const db = supabaseAdmin ?? supabase;
		let convId = conversation_id;

		// If peer_id provided, find or create conversation
		if (!convId && peer_id) {
			const { data: existing, error: findErr } = await db
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
				const { data: created, error: createErr } = await db
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
		const { data: conv, error: convErr } = await db
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

		// Insert message (assumes timestamp column exists and default now())
		const { data: msg, error: msgErr } = await db
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
}

// GET /messages
export async function fetchMessagesHandler(req, res) {
	try {
		const userId = req.user.id;
		const { conversation_id, limit = 20, before } = req.query;
		if (!conversation_id) return res.status(400).json({ error: 'conversation_id is required' });

		const db = supabaseAdmin ?? supabase;

		// Verify membership
		const { data: conv, error: convErr } = await db
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

		let query = db
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
}

// GET /realtime/messages (SSE)
export async function realtimeMessagesHandler(req, res) {
	try {
		const { conversation_id } = req.query;
		if (!conversation_id) return res.status(400).json({ error: 'conversation_id is required' });

		const userId = req.user.id;
		const db = supabaseAdmin ?? supabase;

		// Verify membership before opening stream
		const { data: conv, error: convErr } = await db
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
		channel
			.on('postgres_changes', {
				event: 'INSERT',
				schema: 'public',
				table: 'messages',
				filter: `conversation_id=eq.${conversation_id}`
			}, (payload) => {
				const data = JSON.stringify(payload.new);
				res.write(`event: message\n`);
				res.write(`data: ${data}\n\n`);
			})
			.subscribe();

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
}

