import express from 'express';
import { matchAIHandler } from '../controllers/aiController.js';

const router = express.Router();

// POST /ai/match
router.post('/match', matchAIHandler);

export default router;
