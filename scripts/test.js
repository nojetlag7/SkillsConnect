import dotenv from 'dotenv';
import OpenAI from 'openai';
import {GoogleGenerativeAI as G} from '@google/generative-ai';

dotenv.config();

const apiKey = (process.env.GEMINI_API_KEY || '').replace(/^"(.*)"$/, '$1');
if (!apiKey) {
  console.error('GEMINI_API_KEY is missing');
  process.exit(1);
}

const genAI = new G(apiKey);

// TESTING GEMINI API KEY

async function run(){
	const model =  genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
	const prompt = 'Write a haiku about the sea in 3 lines';

	const res = (await model.generateContent(prompt)).response;
	console.log(res.text());
}

run();

