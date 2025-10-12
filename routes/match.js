import express from 'express';
import { matchHandler } from '../controllers/matchController.js';

const router = express.Router();

// POST /match
router.post('/match', matchHandler);

export default router;
