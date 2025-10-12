//simple signup route with create auth user and profile
app.post('/auth/signup', async (req, res) => {
    try{
        const { email, password } = req.body;

        //some simple validation
        if(!email || !password){
            return res.status(400).json({ error: 'Email and password are required' });
        }
        else if(password.length < 6){
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        else if(!email.includes('@') || !email.includes('.')){
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const { data, error } = await supabase.auth.signUp({ email, password });
        //use data.user to get user info like id, email, etc.
        //use data.session to get session info like access_token, refresh_token, etc.


        if (error) {
            console.error('Signup error:', error);
            return res.status(400).json({ error: error.message });
        }
        
        const userId = data.user.id;
        try{
            const {error} = await supabaseAdmin
                .from('profiles')
                .upsert([{ id: userId, email }], { onConflict: 'id' });

            if(error){
                console.error('Error inserting profile:', error);
            }
        }
        catch(e){
            console.error('Error inserting profile:', e);
        }

        //responding with success message and user data 
        // NB 200 -> OK but 201 -> Created is more appropriate for signup
        res.status(201).json({
            message: 'Signup successful, please check your email to confirm your account.',
            user: data.user.id
        });

    } catch(error){   
        console.error('Unexpected error during signup:', error);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});

//simple login route
app.post('/auth/login', async (req, res) => {
    try{
        const { email, password } = req.body;
        if(!email || !password){
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            console.error('Login error:', error);
            return res.status(400).json({ error: error.message });
        }

        //responding with success message and user data
        res.status(200).json(
            { message: 'Login successful.',
                user: data.user,
                access_token: data.session?.access_token
            });
    }

    catch(error){
        console.error('Unexpected error during login:', error);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});


//authentication middleware

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies?.access_token;
        if (!token) return res.status(401).json({ error: 'Missing auth token' });

        // prefer admin client for getUser if available (works with service role)
        const client = supabaseAdmin ?? supabase;
        const resp = await client.auth.getUser(token);
        //getting the user associated with the token by decoding the JWT token
        const user = resp?.data?.user ?? null;
        const err = resp?.error ?? null;
        if (err || !user) return res.status(401).json({ error: 'Invalid or expired token' });

        req.user = user;
        next();
    } catch (e) {
        console.error('Auth middleware error:', e);
        return res.status(500).json({ error: 'Auth error' });
    }
}

//get all users
app.get('/users', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('*');

        if (error) {
            console.error('Error fetching users:', error);
            return res.status(400).json({ error: 'Failed to fetch users' });
        }

        res.status(200).json({ users: data.map(user => user.id) });
    } catch (e) {
        console.error('Unexpected error fetching users:', e);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});

//read user profile
app.get('/profile/:id', authenticate, async (req, res) => {
    try {
        if(!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const userId = req.params.id;

        if (req.user.id !== userId && !supabaseAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // using admin client when available to bypass RLS
        const client = supabaseAdmin ?? supabase;

        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching user profile:', error);
            return res.status(404).json({ error: 'User not found' });
        }
        if (!data) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ profile: data });
    } catch (e) {
        console.error('Unexpected error fetching user profile:', e);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});

//update user profile
app.put('/profile/:id', authenticate, async (req, res) => {
    try {
        const userId = req.params.id;

        // allow only owner or admin
        if (req.user.id !== userId && !supabaseAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // build updates from allowed keys present in body
        const allowed = ['name', 'email', 'skills', 'bio', 'location'];
        const updates = Object.fromEntries(
            Object.entries(req.body).filter(([k, v]) => allowed.includes(k) && v !== undefined)
        );

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updatable fields provided' });
        }

        const client = supabaseAdmin ?? supabase;
        const { data, error } = await client
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select('*')         // explicitly request all columns
            .maybeSingle();      // avoid throwing if zero rows

        if (error) {
            console.error('Error updating user profile:', error);
            return res.status(400).json({ error: 'Failed to update profile' });
        }

        if (!data) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // return the updated profile (or use 204 if you prefer no body)
        return res.status(200).json({ message: 'Profile updated successfully', profile: data });
    } catch (e) {
        console.error('Unexpected error updating user profile:', e);
        return res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});

//delete user profile
app.delete('/profile/:id', authenticate, async (req, res) => {
    try {
        const userId = req.params.id;
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (error) {
            console.error('Error deleting user profile:', error);
            return res.status(400).json({ error: 'Failed to delete profile' });
        }

        res.status(204).send();
    } catch (e) {
        console.error('Unexpected error deleting user profile:', e);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});
