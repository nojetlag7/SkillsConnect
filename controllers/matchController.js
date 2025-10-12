import { supabase, supabaseAdmin } from '../clients/supabaseClient.js';
import { matchAIHandler } from './aiController.js';

// Helper to call the AI handler locally without HTTP
async function runLocalAI(skills, requirements) {
  return new Promise((resolve) => {
    const mockReq = { body: { skills, requirements } };
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode || 200, data }); }
    };
    matchAIHandler(mockReq, mockRes);
  });
}

export async function matchHandler(req, res) {
  try {
    const { user_id, task_id } = req.body || {};
    if (!user_id || !task_id) return res.status(400).json({ error: 'user_id and task_id are required' });

    const db = supabaseAdmin ?? supabase;

    // Fetch user skills (from profiles.skills)
    const { data: profile, error: pErr } = await db
      .from('profiles')
      .select('id, skills')
      .eq('id', user_id)
      .maybeSingle();
    if (pErr) {
      console.error('Fetch profile error:', pErr);
      return res.status(500).json({ error: 'Failed to load user profile' });
    }
    if (!profile) return res.status(404).json({ error: 'User not found' });

    // Fetch task requirements (from tasks.requirements)
    const { data: task, error: tErr } = await db
      .from('tasks')
      .select('id, requirements')
      .eq('id', task_id)
      .maybeSingle();
    if (tErr) {
      console.error('Fetch task error:', tErr);
      return res.status(500).json({ error: 'Failed to load task' });
    }
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const skills = profile.skills ?? [];
    const requirements = task.requirements ?? [];

    const ai = await runLocalAI(skills, requirements);
    if (ai.status !== 200) {
      return res.status(ai.status).json({ error: 'AI evaluation failed', details: ai.data });
    }

    return res.status(200).json({
      user_id,
      task_id,
      match_score: ai.data.match_score,
      comment: ai.data.comment,
    });
  } catch (e) {
    console.error('Match handler error:', e);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}
