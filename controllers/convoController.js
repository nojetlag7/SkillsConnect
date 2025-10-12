import { supabase, supabaseAdmin } from '../clients/supabaseClient.js';

// POST /conversations
export async function createConversationHandler(req, res) {
	try {
		const userId = req.user.id;
		const { peer_id } = req.body;
		if (!peer_id) return res.status(400).json({ error: 'peer_id is required' });
		if (peer_id === userId) return res.status(400).json({ error: 'Cannot create conversation with yourself' });

		const db = supabaseAdmin ?? supabase;

		// Canonical order (lower UUID first) to enforce unique pair
		const [u1, u2] = [userId, peer_id].sort();

		// Find existing conversation in either user1/user2 order
			const { data: existing, error: findErr } = await db
				.from('conversations')
				.select('*')
				.eq('user1_id', u1)
				.eq('user2_id', u2)
				.maybeSingle();

		if (findErr) {
			console.error('Find conversation error:', findErr);
			return res.status(500).json({ error: 'Failed to lookup conversation' });
		}
		if (existing) return res.status(200).json({ conversation: existing });

		// Create new conversation
			const { data: created, error: createErr } = await db
				.from('conversations')
				.insert([{ user1_id: u1, user2_id: u2 }])
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
			const [u1, u2] = [senderId, peer_id].sort();
			const { data: existing, error: findErr } = await db
				.from('conversations')
				.select('*')
				.eq('user1_id', u1)
				.eq('user2_id', u2)
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
					.insert([{ user1_id: u1, user2_id: u2 }])
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
				.order('created_at', { ascending: false });

		if (before) {
				query = query.lt('created_at', before);
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

	// DELETE /messages/:id (sender-only)
	export async function deleteMessageHandler(req, res) {
		try {
			const userId = req.user.id;
			const { id } = req.params;
			const db = supabaseAdmin ?? supabase;

			const { data: msg, error: getErr } = await db
				.from('messages')
				.select('id,sender_id')
				.eq('id', id)
				.maybeSingle();
			if (getErr) {
				console.error('Get message error:', getErr);
				return res.status(500).json({ error: 'Failed to load message' });
			}
			if (!msg) return res.status(404).json({ error: 'Message not found' });
			if (msg.sender_id !== userId) return res.status(403).json({ error: 'Not allowed to delete this message' });

			const { error: delErr } = await db
				.from('messages')
				.delete()
				.eq('id', id);
			if (delErr) {
				console.error('Delete message error:', delErr);
				return res.status(500).json({ error: 'Failed to delete message' });
			}
			return res.status(204).send();
		} catch (e) {
			console.error('Unexpected error deleting message:', e);
			return res.status(500).json({ error: 'Unexpected error' });
		}
	}

	// GET /conversations/stream (SSE): new conversations involving the user
	export async function conversationsStreamHandler(req, res) {
		try {
			const userId = req.user.id;

			// Setup SSE headers
			res.setHeader('Content-Type', 'text/event-stream');
			res.setHeader('Cache-Control', 'no-cache');
			res.setHeader('Connection', 'keep-alive');
			res.flushHeaders?.();

			// Two subscriptions because filter currently supports a single equality per channel
			const ch1 = supabase.channel(`conversations:u1:${userId}`);
			ch1.on('postgres_changes', {
				event: 'INSERT',
				schema: 'public',
				table: 'conversations',
				filter: `user1_id=eq.${userId}`
			}, (payload) => {
				res.write(`event: conversation\n`);
				res.write(`data: ${JSON.stringify(payload.new)}\n\n`);
			}).subscribe();

			const ch2 = supabase.channel(`conversations:u2:${userId}`);
			ch2.on('postgres_changes', {
				event: 'INSERT',
				schema: 'public',
				table: 'conversations',
				filter: `user2_id=eq.${userId}`
			}, (payload) => {
				res.write(`event: conversation\n`);
				res.write(`data: ${JSON.stringify(payload.new)}\n\n`);
			}).subscribe();

			const interval = setInterval(() => { res.write(': ping\n\n'); }, 25000);
			req.on('close', () => {
				clearInterval(interval);
				ch1.unsubscribe();
				ch2.unsubscribe();
				res.end();
			});
		} catch (e) {
			console.error('Conversations SSE error:', e);
			return res.status(500).json({ error: 'Unexpected error' });
		}
	}

