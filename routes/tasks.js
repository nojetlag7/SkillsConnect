import express from 'express';
import authenticate from '../middleware/auth.js';
import {
	createTaskHandler,
	getTaskHandler,
	updateTaskHandler,
	deleteTaskHandler,
	listTasksHandler
} from '../controllers/tasksController.js';

const router = express.Router();

// All endpoints require authentication
router.use(authenticate);

// List all tasks
router.get('/tasks', listTasksHandler);

// Create a new task
router.post('/tasks', createTaskHandler);

// Get a single task
router.get('/tasks/:id', getTaskHandler);

// Update a task
router.put('/tasks/:id', updateTaskHandler);

// Delete a task
router.delete('/tasks/:id', deleteTaskHandler);

export default router;
