import dotenv from 'dotenv';
import { GoogleGenerativeAI as G } from '@google/generative-ai';

dotenv.config();

const genAI = new G(process.env.GEMINI_API_KEY);
const MODEL_NAME = 'gemini-2.0-flash';

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === 'string') return val.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  return [String(val)].filter(Boolean);
}

function buildPrompt(skills, requirements) {
  return `You are a matching assistant.
Given a user's skills and a task's requirements, return a JSON object with:
- match_score: a number between 0 and 1 with two decimals representing how well the user's skills match the task
- comment: a short sentence explaining the match

Only return JSON. Do not include markdown.

User skills: ${JSON.stringify(skills)}
Task requirements: ${JSON.stringify(requirements)}

Respond strictly in this JSON shape:
{"match_score": 0.00, "comment": "..."}`;
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const cand = text.slice(start, end + 1);
    try { return JSON.parse(cand); } catch { /* fallthrough */ }
  }
  try { return JSON.parse(text); } catch { return null; }
}

export async function matchAIHandler(req, res) {
  try {
    const { skills, requirements } = req.body || {};
    const skillsArr = toArray(skills);
    const reqArr = toArray(requirements);
    if (skillsArr.length === 0 || reqArr.length === 0) {
      return res.status(400).json({ error: 'skills and requirements are required' });
    }

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = buildPrompt(skillsArr, reqArr);
    const resp = (await model.generateContent(prompt)).response;
    const text = resp.text();
    const parsed = extractJson(text);

    if (!parsed || typeof parsed.match_score !== 'number' || typeof parsed.comment !== 'string') {
      return res.status(502).json({ error: 'AI response not in expected JSON format', raw: text });
    }

    // clamp score
    const score = Math.max(0, Math.min(1, parsed.match_score));
    return res.status(200).json({ match_score: Number(score.toFixed(2)), comment: parsed.comment });
  } catch (e) {
    console.error('AI match error:', e);
    return res.status(500).json({ error: 'AI service error' });
  }
}
