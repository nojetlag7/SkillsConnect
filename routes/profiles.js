import express from 'express';
import {authenticate} from '../middleware/authMiddleware.js';
import { listUsersHandler, getProfileHandler, updateProfileHandler, deleteProfileHandler } from '../controllers/profilesController.js';

const router = express.Router();

router.use(authenticate);
router.get('/users', listUsersHandler);
router.get('/users/:id', getProfileHandler);
router.put('/users/:id', updateProfileHandler);
router.delete('/users/:id', deleteProfileHandler);

export default router;