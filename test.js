import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();





const client = new OpenAI({apiKey : process.env.OPENAI_API_KEY});
// TESTING OPEN AI API KEY
const openaiApiKey = process.env.OPENAI_API_KEY;

const res = await client.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [
	{ role: "user", content: "Say this is a test!" }
  ],
});

console.log(res);

// maybe export if needed later
module.exports = postmanCollection;
export default postmanCollection;