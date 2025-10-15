# SkillsConnect API – Postman Testing Guide

Base URL: http://localhost:3000

Test account to use:
- email: jerbtime99@gmail.com
- password: Test123!

Auth header for protected endpoints:
- Authorization: Bearer <access_token>

Tip: Log in first to get `session.access_token`, then set it as a Postman collection variable `token` and use `Bearer {{token}}` on protected requests.

---

## 1) Auth

### POST /auth/signup (TESTED)
- Purpose: Create an auth user and a profile row.
- Auth: Not required
- Body (JSON):
```json
{
  "email": "jerbtime99@gmail.com",
  "password": "Test123!",
  "full_name": "Jerb Time"    
}
```
- Success 201:
```json
{
  "message": "Signup successful",
  "userId": "<uuid>"
}
```
- Notes: If the user already exists, you’ll get a 400 with an error message.

### POST /auth/login (TESTED)
- Purpose: Sign in and retrieve an access token
- Auth: Not required
- Body (JSON):
```json
{
  "email": "jerbtime99@gmail.com",
  "password": "Test123!"
}
```
- Success 200:
```json
{
  "message": "Login successful",
  "user": { /* supabase user object */ },
  "session": {
    "access_token": "<token>"
  }
}
```
- Copy `session.access_token` into your Postman variable `token`.

---

## 2) Profiles (mounted at /profiles) (TESTED)
All routes below require Authorization: Bearer {{token}}

### GET /profiles/users
- Purpose: List all profile IDs
- Success 200:
```json
{
  "users": ["<uuid>", "<uuid>"]
}
```

### GET /profiles/users/:id (TESTED)
- Purpose: Get a specific user profile
- Params: `:id` is the user id (uuid)
- Success 200:
```json
{
  "profile": {
    "id": "<uuid>",
    "email": "...",
    "name": "...",
    "skills": ["..."],
    "bio": "...",
    "location": "...",
    "created_at": "..."
  }
}
```

### PUT /profiles/users/:id (TESTED)
- Purpose: Update allowed fields of a profile (owner or admin)
- Body (any subset of): { name, email, skills, bio, location }
- Example body:
```json
{
  "name": "Jerb Time",
  "skills": ["node", "express", "supabase"],
  "bio": "Hello!"
}
```
- Success 200:
```json
{
  "message": "Profile updated successfully",
  "profile": { /* updated profile */ }
}
```

### DELETE /profiles/users/:id
- Purpose: Delete a profile. Returns 204 No Content.

---

## 3) Conversations (root-level)
All routes below require Authorization: Bearer {{token}}

### POST /conversations
- Purpose: Create or return the conversation between you and a peer
- Body (JSON):
```json
{
  "peer_id": "<other_user_uuid>"
}
```
- Success 200/201:
```json
{
  "conversation": {
    "id": "<uuid>",
    "user1_id": "<uuid>",
    "user2_id": "<uuid>",
    "created_at": "..."
  }
}
```
- Behavior: Enforces one conversation per user pair (canonical order).

### GET /conversations
- Purpose: List conversations for the authenticated user
- Success 200:
```json
{
  "conversations": [
    { "id": "...", "user1_id": "...", "user2_id": "...", "created_at": "..." }
  ]
}
```

### GET /conversations/stream (SSE)
- Purpose: Stream newly inserted conversations involving the authenticated user
- Notes: In Postman, the response will stay open; you’ll see events as they arrive.

---

## 4) Messages (root-level)
All routes below require Authorization: Bearer {{token}}

### POST /messages
- Purpose: Send a message in a conversation (create the convo if only peer_id is provided)
- Body options (one of):
```json
{
  "conversation_id": "<uuid>",
  "text": "Hello there"
}
```
OR
```json
{
  "peer_id": "<other_user_uuid>",
  "text": "Hello via auto-convo"
}
```
- Success 201:
```json
{
  "message": {
    "id": "<uuid>",
    "conversation_id": "<uuid>",
    "sender_id": "<your_user_id>",
    "text": "...",
    "created_at": "..."
  }
}
```

### GET /messages
- Purpose: Fetch messages in a conversation (newest-first)
- Query params:
  - conversation_id (required)
  - limit (optional, default 20, max 100)
  - before (optional, ISO timestamp for pagination cursor using created_at)
- Example: `/messages?conversation_id=<uuid>&limit=20`
- Success 200:
```json
{
  "messages": [
    { "id": "...", "text": "...", "created_at": "..." }
  ]
}
```

### DELETE /messages/:id
- Purpose: Delete your own message
- Success: 204 No Content

### GET /messages/stream (SSE)
- Purpose: Stream newly inserted messages for a conversation
- Query: `conversation_id=<uuid>`
- Notes: In Postman, the response will remain open and stream events.

---

## 5) AI

### POST /ai/match
- Purpose: Compute a match score given skills and requirements (direct AI call)
- Body (JSON):
```json
{
  "skills": ["react", "firebase"],
  "requirements": ["react", "firebase", "testing"]
}
```
- Success 200:
```json
{
  "match_score": 0.87,
  "comment": "Strong match in React and Firebase"
}
```

---

## 6) Match (DB + AI chaining) (Tested)

### POST /match
- Purpose: Load user skills and task requirements from DB, then call AI to compute match
- Body (JSON):
```json
{
  "user_id": "<uuid>",
  "task_id": "<uuid>"
}
```
- Success 200:
```json
{
  "user_id": "<uuid>",
  "task_id": "<uuid>",
  "match_score": 0.87,
  "comment": "Strong match in React and Firebase"
}
```
- Notes: Ensure a task record exists with `requirements` (text[]) and that the profile `skills` (text[]) is set for the user.

---

## Postman Flow (Suggested)
1) Auth > Login (save session.access_token to `{{token}}`)
2) Profiles > GET /profiles/users (pick your user id)
3) Conversations > POST /conversations (use a peer id)
4) Messages > POST /messages, GET /messages
5) SSE > GET /messages/stream & GET /conversations/stream
6) AI > POST /ai/match
7) Match > POST /match (with a valid user_id & task_id)

---

## 7) Tasks (root-level)
All routes below require Authorization: Bearer {{token}}

Notes
- requirements is expected to be a text[] on the tasks table (e.g., ["react", "firebase"]).
- Responses here reflect the current API: arrays are returned directly for list endpoints, not wrapped.

### GET /tasks
- Purpose: List tasks (newest-first)
- Query params:
  - limit (optional, default 20)
  - offset (optional, default 0)
- Example: `/tasks?limit=10&offset=0`
- Success 200:
```json
[
  {
    "id": "<uuid>",
    "title": "Frontend Intern",
    "description": "Assist with React components",
    "requirements": ["react", "javascript", "css"],
    "created_at": "..."
  }
]
```

### POST /tasks
- Purpose: Create a new task
- Body (JSON):
```json
{
  "title": "Frontend Intern",
  "description": "Assist with React components",
  "requirements": ["react", "javascript", "css"]
}
```
- Success 201:
```json
{
  "id": "<uuid>",
  "title": "Frontend Intern",
  "description": "Assist with React components",
  "requirements": ["react", "javascript", "css"],
  "created_at": "..."
}
```

### GET /tasks/:id
- Purpose: Fetch a single task by id
- Params: `:id` is the task id (uuid)
- Success 200:
```json
{
  "id": "<uuid>",
  "title": "Frontend Intern",
  "description": "Assist with React components",
  "requirements": ["react", "javascript", "css"],
  "created_at": "..."
}
```
- 404 if not found.

### PUT /tasks/:id
- Purpose: Update a task
- Body (any subset of): { title, description, requirements }
- Example body:
```json
{
  "title": "Frontend Intern (Updated)",
  "requirements": ["react", "javascript", "css", "testing"]
}
```
- Success 200:
```json
{
  "id": "<uuid>",
  "title": "Frontend Intern (Updated)",
  "description": "Assist with React components",
  "requirements": ["react", "javascript", "css", "testing"],
  "created_at": "..."
}
```
- 404 if not found.

### DELETE /tasks/:id
- Purpose: Delete a task
- Success: 204 No Content

Tip: Create a task first with POST /tasks and use its id for the /match endpoint.
