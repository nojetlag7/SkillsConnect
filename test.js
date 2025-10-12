import dotenv from 'dotenv';
import OpenAI from 'openai';
import {GoogleGenerativeAI as G} from '@google/generative-ai';

dotenv.config();

const genAI = new G(process.env.GEMINI_API_KEY);


// TESTING GEMINI API KEY

async function run(){
	const model =  genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
	const prompt = 'Write a poem about a lost painter';

	const result = await model.generateContent(prompt);
	const res = await result.response;
	const text = res.text();
	console.log(text);
}

run();

