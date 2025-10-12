import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
	createConversationHandler,
	listConversationsHandler,
	sendMessageHandler,
	fetchMessagesHandler,
	realtimeMessagesHandler,
	deleteMessageHandler,
	conversationsStreamHandler,
} from '../controllers/convoController.js';

const router = express.Router();

// Conversations
router.post('/conversations', authenticate, createConversationHandler);
router.get('/conversations', authenticate, listConversationsHandler);

// Messages
router.post('/messages', authenticate, sendMessageHandler);
router.get('/messages', authenticate, fetchMessagesHandler);
router.delete('/messages/:id', authenticate, deleteMessageHandler);

// Realtime (SSE) at a clear path
router.get('/messages/stream', authenticate, realtimeMessagesHandler);
router.get('/conversations/stream', authenticate, conversationsStreamHandler);

export default router;

