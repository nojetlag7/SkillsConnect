import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import profilesRouter from './routes/profiles.js';
import messagesRouter from './routes/messages.js';
import aiRouter from './routes/ai.js';
import matchRouter from './routes/match.js';
import { createClient } from '@supabase/supabase-js';


dotenv.config(); // loading environment variables from .env file

const app = express(); 
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));


app.use('/auth', authRouter); // /login and /signup
app.use('/profiles', profilesRouter); // now exposes /profiles/users and /profiles/users/:id
app.use('/', messagesRouter); // exposes /conversations, /messages, /messages/stream at root
app.use('/ai', aiRouter); // /ai/match
app.use('/', matchRouter); // /match



app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); //showing that app is running on the specified port

