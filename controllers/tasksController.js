import { supabaseAdmin } from '../clients/supabaseClient.js';

// Create a new task
export async function createTaskHandler(req, res) {
	try {
		const { title, description, requirements } = req.body;
		if (!title) return res.status(400).json({ error: 'Title is required' });
		const { data, error } = await supabaseAdmin
			.from('tasks')
			.insert([{ title, description, requirements }])
			.select()
			.single();
		if (error) return res.status(400).json({ error: error.message });
		res.status(201).json(data);
	} catch (e) {
		res.status(500).json({ error: 'Server error' });
	}
}

// Get a single task by id
export async function getTaskHandler(req, res) {
	try {
		const { id } = req.params;
		const { data, error } = await supabaseAdmin
			.from('tasks')
			.select('*')
			.eq('id', id)
			.single();
		if (error || !data) return res.status(404).json({ error: 'Task not found' });
		res.json(data);
	} catch (e) {
		res.status(500).json({ error: 'Server error' });
	}
}

// Update a task by id
export async function updateTaskHandler(req, res) {
	try {
		const { id } = req.params;
		const { title, description, requirements } = req.body;
		const { data, error } = await supabaseAdmin
			.from('tasks')
			.update({ title, description, requirements })
			.eq('id', id)
			.select()
			.single();
		if (error || !data) return res.status(404).json({ error: error?.message || 'Task not found' });
		res.json(data);
	} catch (e) {
		res.status(500).json({ error: 'Server error' });
	}
}

// Delete a task by id
export async function deleteTaskHandler(req, res) {
	try {
		const { id } = req.params;
		const { error } = await supabaseAdmin
			.from('tasks')
			.delete()
			.eq('id', id);
		if (error) return res.status(404).json({ error: error.message });
		res.status(204).send();
	} catch (e) {
		res.status(500).json({ error: 'Server error' });
	}
}

// List all tasks (optionally with pagination)
export async function listTasksHandler(req, res) {
	try {
		const { limit = 20, offset = 0 } = req.query;
		const { data, error } = await supabaseAdmin
			.from('tasks')
			.select('*')
			.range(Number(offset), Number(offset) + Number(limit) - 1)
			.order('created_at', { ascending: false });
		if (error) return res.status(400).json({ error: error.message });
		res.json(data);
	} catch (e) {
		res.status(500).json({ error: 'Server error' });
	}
}
