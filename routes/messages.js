import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
	createConversationHandler,
	listConversationsHandler,
	sendMessageHandler,
	fetchMessagesHandler,
	realtimeMessagesHandler,
} from '../controllers/convoController.js';

const router = express.Router();

// Conversations
router.post('/conversations', authenticate, createConversationHandler);
router.get('/conversations', authenticate, listConversationsHandler);

// Messages
router.post('/messages', authenticate, sendMessageHandler);
router.get('/messages', authenticate, fetchMessagesHandler);

// Realtime (SSE) at a clear path
router.get('/messages/stream', authenticate, realtimeMessagesHandler);

export default router;

