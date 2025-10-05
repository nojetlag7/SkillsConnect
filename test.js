/**
 * Postman Collection (v2.1) for SkillsConnect API
 *
 * How to use:
 * - In Postman, click Import > Raw Text, then paste ONLY the JSON object assigned to `postmanCollection` below
 *   (from the opening `{` to the closing `}`) and click Import. Or save that JSON to a file and import it.
 * - Update the collection variables (email, password, peer_id, etc.) as needed.
 * - Run Auth > Login first to populate {{token}} and {{user_id}} for protected routes.
 */

const postmanCollection = {
	info: {
		name: "SkillsConnect API",
		schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		_postman_id: "6f9e8c7e-7b1b-4a49-9b3a-1f1a2b3c4d5e"
	},
	variable: [
		{ key: "baseUrl", value: "http://localhost:3000", type: "string" },
		{ key: "email", value: "test.user@example.com", type: "string" },
		{ key: "password", value: "Passw0rd!", type: "string" },
		{ key: "token", value: "", type: "string" },
		{ key: "user_id", value: "", type: "string" },
		{ key: "peer_id", value: "", type: "string" },
		{ key: "conversation_id", value: "", type: "string" }
	],
	item: [
		{
			name: "Auth",
			item: [
				{
					name: "Signup",
					request: {
						method: "POST",
						header: [
							{ key: "Content-Type", value: "application/json" }
						],
						url: {
							raw: "{{baseUrl}}/auth/signup",
							host: ["{{baseUrl}}"],
							path: ["auth", "signup"]
						},
						body: {
							mode: "raw",
							raw: JSON.stringify({ email: "{{email}}", password: "{{password}}" })
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('Status is 201', function () { pm.response.to.have.status(201); });",
									"try {",
									"  const json = pm.response.json();",
									"  if (json && json.user) {",
									"    pm.collectionVariables.set('user_id', json.user);",
									"  }",
									"} catch (e) { /* ignore */ }"
								]
							}
						}
					]
				},
				{
					name: "Login",
					request: {
						method: "POST",
						header: [
							{ key: "Content-Type", value: "application/json" }
						],
						url: {
							raw: "{{baseUrl}}/auth/login",
							host: ["{{baseUrl}}"],
							path: ["auth", "login"]
						},
						body: {
							mode: "raw",
							raw: JSON.stringify({ email: "{{email}}", password: "{{password}}" })
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('Status is 200', function () { pm.response.to.have.status(200); });",
									"try {",
									"  const json = pm.response.json();",
									"  if (json && json.access_token) { pm.collectionVariables.set('token', json.access_token); }",
									"  if (json && json.user && json.user.id) { pm.collectionVariables.set('user_id', json.user.id); }",
									"} catch (e) { /* ignore */ }"
								]
							}
						}
					]
				}
			]
		},
		{
			name: "Profiles",
			item: [
				{
					name: "Get Users (IDs)",
					request: {
						method: "GET",
						header: [
							{ key: "Authorization", value: "Bearer {{token}}" }
						],
						url: {
							raw: "{{baseUrl}}/users",
							host: ["{{baseUrl}}"],
							path: ["users"]
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('Status is 200', function () { pm.response.to.have.status(200); });"
								]
							}
						}
					]
				},
				{
					name: "Get My Profile",
					request: {
						method: "GET",
						header: [
							{ key: "Authorization", value: "Bearer {{token}}" }
						],
						url: {
							raw: "{{baseUrl}}/profile/{{user_id}}",
							host: ["{{baseUrl}}"],
							path: ["profile", "{{user_id}}"]
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('Status is 200', function () { pm.response.to.have.status(200); });"
								]
							}
						}
					]
				},
				{
					name: "Update My Profile",
					request: {
						method: "PUT",
						header: [
							{ key: "Content-Type", value: "application/json" },
							{ key: "Authorization", value: "Bearer {{token}}" }
						],
						url: {
							raw: "{{baseUrl}}/profile/{{user_id}}",
							host: ["{{baseUrl}}"],
							path: ["profile", "{{user_id}}"]
						},
						body: {
							mode: "raw",
							raw: JSON.stringify({ name: "Test User", skills: ["node", "express"], bio: "Hello!" })
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('Status is 200', function () { pm.response.to.have.status(200); });"
								]
							}
						}
					]
				},
				{
					name: "Delete My Profile (danger)",
					disabled: true,
					request: {
						method: "DELETE",
						header: [
							{ key: "Authorization", value: "Bearer {{token}}" }
						],
						url: {
							raw: "{{baseUrl}}/profile/{{user_id}}",
							host: ["{{baseUrl}}"],
							path: ["profile", "{{user_id}}"]
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('Status is 204', function () { pm.response.to.have.status(204); });"
								]
							}
						}
					]
				}
			]
		},
		{
			name: "Conversations",
			item: [
				{
					name: "Create (with peer_id)",
					request: {
						method: "POST",
						header: [
							{ key: "Content-Type", value: "application/json" },
							{ key: "Authorization", value: "Bearer {{token}}" }
						],
						url: {
							raw: "{{baseUrl}}/conversations",
							host: ["{{baseUrl}}"],
							path: ["conversations"]
						},
						body: {
							mode: "raw",
							raw: JSON.stringify({ peer_id: "{{peer_id}}" })
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('Status is 200/201', function () { pm.expect([200,201]).to.include(pm.response.code); });",
									"try {",
									"  const json = pm.response.json();",
									"  if (json && json.conversation && json.conversation.id) { pm.collectionVariables.set('conversation_id', json.conversation.id); }",
									"} catch (e) { /* ignore */ }"
								]
							}
						}
					]
				},
				{
					name: "List My Conversations",
					request: {
						method: "GET",
						header: [
							{ key: "Authorization", value: "Bearer {{token}}" }
						],
						url: {
							raw: "{{baseUrl}}/conversations",
							host: ["{{baseUrl}}"],
							path: ["conversations"]
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('Status is 200', function () { pm.response.to.have.status(200); });",
									"try {",
									"  const json = pm.response.json();",
									"  if (json && Array.isArray(json.conversations) && json.conversations.length > 0) {",
									"    const id = json.conversations[0].id; pm.collectionVariables.set('conversation_id', id);",
									"  }",
									"} catch (e) { /* ignore */ }"
								]
							}
						}
					]
				}
			]
		},
		{
			name: "Messages",
			item: [
				{
					name: "Send by conversation_id",
					request: {
						method: "POST",
						header: [
							{ key: "Content-Type", value: "application/json" },
							{ key: "Authorization", value: "Bearer {{token}}" }
						],
						url: {
							raw: "{{baseUrl}}/messages",
							host: ["{{baseUrl}}"],
							path: ["messages"]
						},
						body: {
							mode: "raw",
							raw: JSON.stringify({ conversation_id: "{{conversation_id}}", text: "Hello from Postman" })
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('Status is 201', function () { pm.response.to.have.status(201); });",
									"try {",
									"  const json = pm.response.json();",
									"  if (json && json.message && json.message.conversation_id) { pm.collectionVariables.set('conversation_id', json.message.conversation_id); }",
									"} catch (e) { /* ignore */ }"
								]
							}
						}
					]
				},
				{
					name: "Send by peer_id (auto create convo if needed)",
					request: {
						method: "POST",
						header: [
							{ key: "Content-Type", value: "application/json" },
							{ key: "Authorization", value: "Bearer {{token}}" }
						],
						url: {
							raw: "{{baseUrl}}/messages",
							host: ["{{baseUrl}}"],
							path: ["messages"]
						},
						body: {
							mode: "raw",
							raw: JSON.stringify({ peer_id: "{{peer_id}}", text: "Hi peer!" })
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('Status is 201', function () { pm.response.to.have.status(201); });",
									"try {",
									"  const json = pm.response.json();",
									"  if (json && json.message && json.message.conversation_id) { pm.collectionVariables.set('conversation_id', json.message.conversation_id); }",
									"} catch (e) { /* ignore */ }"
								]
							}
						}
					]
				},
				{
					name: "Fetch messages (newest-first)",
					request: {
						method: "GET",
						header: [
							{ key: "Authorization", value: "Bearer {{token}}" }
						],
						url: {
							raw: "{{baseUrl}}/messages?conversation_id={{conversation_id}}&limit=20",
							host: ["{{baseUrl}}"],
							path: ["messages"],
							query: [
								{ key: "conversation_id", value: "{{conversation_id}}" },
								{ key: "limit", value: "20" }
							]
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('Status is 200', function () { pm.response.to.have.status(200); });"
								]
							}
						}
					]
				}
			]
		},
		{
			name: "Realtime (SSE)",
			item: [
				{
					name: "Subscribe to messages via SSE",
					request: {
						method: "GET",
						header: [
							{ key: "Authorization", value: "Bearer {{token}}" }
						],
						url: {
							raw: "{{baseUrl}}/realtime/messages?conversation_id={{conversation_id}}",
							host: ["{{baseUrl}}"],
							path: ["realtime", "messages"],
							query: [
								{ key: "conversation_id", value: "{{conversation_id}}" }
							]
						}
					},
					event: [
						{
							listen: "test",
							script: {
								type: "text/javascript",
								exec: [
									"pm.test('SSE request sent (server will keep connection open)', function () { pm.expect(pm.response.code).to.be.oneOf([200, 0]); });"
								]
							}
						}
					]
				}
			]
		}
	]
};

// Export (optional if you want to require this file in Node)
module.exports = postmanCollection;
export default postmanCollection;

