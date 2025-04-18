const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server

const app = express();
const PORT = 3000;

app.engine('hbs', exphbs.engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());

// *****************************************************
//                    API Routes
// *****************************************************

app.get('/', (req, res) => {
    res.render('pages/register');
});

app.get('/register', (req, res) => {
    res.render('pages/register');
});

app.get('/notes', (req, res) => {
    res.render('pages/notes');
});

app.get('/store', (req, res) => {
    res.render('pages/store');
});

app.get('/notifications', (req, res) => {
    res.render('pages/notifications');
});

app.get('/calendar', (req, res) => {
    res.render('pages/calendar');
});

app.get('/friends', (req, res) => {
    res.render('pages/friends');
});

app.get('/login', (req, res) => {
    res.render('pages/login');
});

app.get('/welcome', (req, res) => {
    res.json({ status: 'success', message: 'Welcome!' });
});

app.get('/home', (req, res) => {
    res.render('pages/home');
});

app.get('/settings', (req, res) => {
    res.render('pages/settings');
});

app.get('/aboutus', (req, res) => {
    res.render('pages/aboutus'); // assuming your HBS file is in views/pages/profile.hbs
});

app.get('/changepassword', (req, res) => {
    res.render('pages/changepassword');
});

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');



// *****************************************************
//                    Register
// *****************************************************


const hbs = exphbs.create({
    extname: 'hbs',
    layoutsDir: __dirname + '/views/layouts',
    partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
    host: process.env.POSTGRES_HOST, // the database host
    port: process.env.POSTGRES_PORT, // the database port
    database: process.env.POSTGRES_DB, // the database name
    user: process.env.POSTGRES_USER, // the user account to connect with
    password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
    .then(obj => {
        console.log('Database connection successful'); // you can view this message in the docker compose logs
        obj.done(); // success, release the connection;
    })
    .catch(error => {
        console.log('ERROR:', error.message || error);
    });

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        saveUninitialized: false,
        resave: false,
    })
);

app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);

// Authentication Required  
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render('pages/register', {
            error: 'Username and password are required.',
            username: username
        });
    }

    try {
        const userExists = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);
        if (userExists) {
            return res.render('pages/register', {
                error: 'Username already exists.',
                username: username
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.none('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.redirect('/login');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('pages/register', {
            error: 'Registration failed. Please try again.',
            username: username
        });
    }
});


// *****************************************************
//               login
// *****************************************************


app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const testpass = 'password123'
    const hash = await bcrypt.hash(testpass, 10);
    console.log('Encrypted password 1:', hash);
    try {
        const user = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);

        if (!user) {
            return res.render('pages/login', {
                error: 'No User Found',
                username: username
            });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.render('pages/login', {
                error: 'Incorrect password.',
                username: username
            });
        }

        req.session.user = user;
        req.session.save(() => res.redirect('/home'));
    } catch (error) {
        console.error(error);
        res.render('pages/login', {
            error: 'Something went wrong. Please try again.',
            username: username
        });
    }
});


// *****************************************************
//               Logout Route
// *****************************************************

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.clearCookie('connect.sid'); // Clear session cookie
        res.json({ message: 'Logged out successfully' });
    });
});

// *****************************************************
//               Delete profile Route
// *****************************************************

app.delete('/delete-profile', async (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const username = user.username;

    try {
        // Begin a transaction to ensure atomic deletion
        await db.tx(async t => {
            // Delete user references in other tables
            await t.none('DELETE FROM leaderboard_members WHERE username = $1', [username]);
            await t.none('DELETE FROM leaderboards WHERE created_by = $1', [username]);
            await t.none('DELETE FROM friends WHERE username = $1 OR friend_username = $1', [username]);
            await t.none('DELETE FROM calendar_events WHERE username = $1', [username]);
            await t.none('DELETE FROM study_notes WHERE username = $1', [username]);
            await t.none('DELETE FROM user_themes WHERE username = $1', [username]);
            await t.none('DELETE FROM user_clothing WHERE username = $1', [username]);
            await t.none('DELETE FROM sessions WHERE username = $1', [username]);
            await t.none('DELETE FROM goals WHERE username = $1', [username]);

            // Finally delete the user
            await t.none('DELETE FROM users WHERE username = $1', [username]);
        });

        // Destroy the session
        req.session.destroy(err => {
            if (err) {
                console.error('Session destroy error:', err);
                return res.status(500).json({ message: 'Error logging out after deletion' });
            }
            res.clearCookie('connect.sid');
            res.json({ message: 'Profile and all related data deleted successfully' });
        });
    } catch (err) {
        console.error('Error deleting profile:', err);
        res.status(500).json({ message: 'Failed to delete profile and related data' });
    }
});

// *****************************************************
//               Change password
// *****************************************************

app.post('/change-password', async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.render('pages/changepassword', { error: 'Please fill out all fields.' });
    }

    if (newPassword !== confirmPassword) {
        return res.render('pages/changepassword', { error: 'New passwords do not match.' });
    }

    try {
        const user = req.session.user;
        const userData = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [user.username]);

        if (!userData) {
            return res.render('pages/changepassword', { error: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, userData.password);

        if (!isMatch) {
            return res.render('pages/changepassword', { error: 'Incorrect current password.' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.none('UPDATE users SET password = $1 WHERE username = $2', [hashedNewPassword, user.username]);

        res.redirect('/settings'); // After successful password change, redirect to settings
    } catch (error) {
        console.error('Error changing password:', error);
        res.render('pages/changepassword', { error: 'Something went wrong. Please try again.' });
    }
});

// *****************************************************
//               Notes
// *****************************************************

app.get('/api/notes', async (req, res) => {
    console.log('Current session user:', req.session.user);
    const user = req.session.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const notes = await db.any(
            'SELECT * FROM study_notes WHERE username = $1',
            [user.username]
        );
        res.json(notes);
    } catch (err) {
        console.error('Error fetching notes:', err);
        res.status(500).json({ error: 'Could not fetch notes' });
    }
});





app.post('/api/notes', async (req, res) => {
    const user = req.session.user;
    const { content, pos_left = 100, pos_top = 100 } = req.body;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const newNote = await db.one(
            `INSERT INTO study_notes (username, content, pos_left, pos_top)
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [user.username, content, pos_left, pos_top]
        );
        res.status(201).json(newNote);
    } catch (err) {
        console.error('Error creating note:', err);
        res.status(500).json({ error: 'Could not save note' });
    }
});

//               Update Study Note API


app.put('/api/notes/:id', async (req, res) => {
    const user = req.session.user;
    const { content, pos_left, pos_top } = req.body;
    const noteId = req.params.id;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        await db.none(
            `UPDATE study_notes
       SET content = $1, pos_left = $2, pos_top = $3
       WHERE note_id = $4 AND username = $5`,
            [content, pos_left, pos_top, noteId, user.username]
        );
        res.status(200).json({ message: 'Note updated' });
    } catch (err) {
        console.error('Error updating note:', err);
        res.status(500).json({ error: 'Could not update note' });
    }
});


//               Delete Study Note API


app.delete('/api/notes/:id', async (req, res) => {
    const user = req.session.user;
    const noteId = req.params.id;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        await db.none(
            `DELETE FROM study_notes WHERE note_id = $1 AND username = $2`,
            [noteId, user.username]
        );
        res.status(200).json({ message: 'Note deleted' });
    } catch (err) {
        console.error('Error deleting note:', err);
        res.status(500).json({ error: 'Could not delete note' });
    }
});

// *****************************************************
//               Save Study Session API
// *****************************************************

app.post('/api/sessions', async (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    const { title, start_time, end_time } = req.body;

    if (!start_time || !end_time) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        await db.none(
            'INSERT INTO sessions (username, start_time, end_time) VALUES ($1, $2, $3)',
            [user.username, start_time, end_time]
        );

        res.status(201).json({ message: 'Session saved successfully.' });
    } catch (err) {
        console.error('Error saving session:', err);
        res.status(500).json({ error: 'Database error while saving session.' });
    }
});


// *****************************************************
//               Get Study Sessions API
// *****************************************************

app.get('/api/sessions', async (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    try {
        const sessions = await db.any(
            'SELECT session_id, start_time, end_time FROM sessions WHERE username = $1',
            [user.username]
        );

        // Format for FullCalendar
        const formatted = sessions.map(session => ({
            id: session.session_id,
            title: 'Study',
            start: session.start_time,
            end: session.end_time
        }));

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching sessions:', err);
        res.status(500).json({ error: 'Failed to load sessions' });
    }
});