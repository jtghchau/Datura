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

// app.get('/leaderboard', (req, res) => {
//     res.render('pages/leaderboard');
// });

// app.get('/friends', (req, res) => {
//     res.render('pages/friends');
// });
//Do not uncomment this or else the friend request function will not work.


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
    helpers: {
        eq: function (a, b) { return a === b; }
    }
});

// database configuration
const dbConfig = {
    host: 'db', // the database server
    port: 5432, // the database port
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
                error: 'Incorrect username or password.',
                username: username
            });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.render('pages/login', {
                error: 'Incorrect username or password.',
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
//                    Friends
// *****************************************************

app.get('/friends', async (req, res) => {


    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        //gets friends list from both cases where user is the one that requested or got requested
        const friends = await db.any(
            `SELECT CASE WHEN username = $1 THEN friend_username ELSE username 
            END as friend_name FROM friends 
            WHERE (username = $1 OR friend_username = $1) 
            AND status = 'accepted'`,
            [req.session.user.username]
        );

        //gets pending reqs
        const friend_requests = await db.any(
            'SELECT username FROM friends WHERE friend_username = $1 AND status = $2',
            [req.session.user.username, 'pending']
        );

        //gets or creates leaderboard for user
        let leaderboard = await db.oneOrNone(
            'SELECT leaderboard_id FROM leaderboards WHERE created_by = $1 LIMIT 1',
            [req.session.user.username]
        );

        //inserts into table 
        if (!leaderboard) {
            leaderboard = await db.one(
                'INSERT INTO leaderboards (name, created_by) VALUES ($1, $2) RETURNING leaderboard_id',
                [`${req.session.user.username}'s Leaderboard`, req.session.user.username]
            );
        }

        //renders everything necessary/data
        res.render('pages/friends', {
            friends,
            friend_requests,
            success: req.query.success,
            error: req.query.error,
            currentLeaderboardId: leaderboard.leaderboard_id
        });
    } catch (error) {
        console.error(error);
        res.render('pages/friends', { error: 'Error getting friends' });
    }
});

//add friends 
app.post('/friends/add', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const { friend_username } = req.body;

    //cannot add yourself
    if (friend_username === req.session.user.username) {
        return res.render('pages/friends', {
            error: 'Cannot add self as a friend'
        });
    }

    try {
        //checks if user/friend exists
        const existingUser = await db.oneOrNone(
            `SELECT * FROM users WHERE username = $1`,
            [friend_username]
        );

        //if user doesnt exist then it cant be found
        if (!existingUser) {
            return res.render('pages/friends', {
                error: `User ${friend_username} cannot be found`
            });
        }

        //checks if friend req exists
        const existingReq = await db.oneOrNone(`
            SELECT * FROM friends 
            WHERE (username = $1 AND friend_username = $2)
            OR (username = $2 AND friend_username = $1)
        `, [req.session.user.username, friend_username]);

        //you cant send another request if you already sent one
        if (existingReq) {
            if (existingReq.status === 'pending') {
                return res.render('pages/friends', {
                    error: existingReq.username === req.session.user.username
                        ? 'Request already sent' : 'Pending request already exists from this user'
                });
            } else {
                return res.render('pages/friends', {
                    error: 'This user is already your friend.'
                });
            }
        }

        //create new friend req
        await db.none(
            'INSERT INTO friends (username, friend_username, status) VALUES ($1, $2, $3)',
            [req.session.user.username, friend_username, 'pending']
        );
        res.redirect('/friends?success=request_sent');
    } catch (error) {
        console.error(error);
        res.render('pages/friends', { error: 'Unable to add friend' });
    }
});

//remove friend
app.post('/friends/remove', async (req, res) => {


    const { friend_username } = req.body;

    //if no user or no valid session return error
    if (!friend_username || !req.session.user) {
        return res.status(400);
    }


    try {
        //delete friendship from both sides
        await db.none(`
            DELETE FROM friends 
            WHERE (username = $1 AND friend_username = $2)
            OR (username = $2 AND friend_username = $1)
        `, [req.session.user.username, friend_username]);

        res.redirect('/friends?success=friend_removed');
    } catch (error) {
        console.error(error);
        res.render('pages/friends', { error: 'Error removing friend' });
    }
});

//accept friend
app.get('/friends/accepted', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        //update friend status to accepted
        const friends = await db.any(
            'SELECT friend_username FROM friends WHERE username = $1 AND status = $2',
            [req.session.user.username, 'accepted']
        );
        res.render('pages/friends', { friends });
    } catch (error) {
        console.error(error);
        res.render('pages/friends', { error: 'Error getting friends' });
    }
});

//linked to button in friends.hbs
app.post('/friends/accept', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const { requester } = req.body;
    try {
        await db.none(`
            UPDATE friends 
            SET status = 'accepted'
            WHERE username = $1 AND friend_username = $2
            `, [requester, req.session.user.username]);
        res.redirect('/friends?success=request_accepted');
    } catch (error) {
        console.error(error);
        res.render('pages/friends', { error: 'Error accepting' });
    }
});

//decline req
app.post('/friends/decline', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const { requester } = req.body;

    try {
        //deletes friend req
        await db.none(`
            DELETE FROM friends 
            WHERE username = $1 AND friend_username = $2
        `, [requester, req.session.user.username]);

        res.redirect('/friends?success=request_declined');
    } catch (error) {
        console.error(error);
        res.render('pages/friends', { error: 'Error declining request' });
    }
});

// *****************************************************
//                    Leaderboard
// *****************************************************

//main leaderboard page
app.get('/leaderboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    try {
        //gets pending invites
        const invite_requests = await db.any(
            `SELECT li.invite_id, li.from_user, li.leaderboard_id, lb.name AS leaderboard_name
        FROM leaderboard_invites li JOIN leaderboards lb
        ON lb.leaderboard_id = li.leaderboard_id
        WHERE li.to_user = $1
        AND li.status = 'pending'`,
            [req.session.user.username]
        );

        //gets leaderboard if from query or finds the one user is apart of 
        const leaderboard_id = req.query.leaderboard_id || null;
        let leaderboard = null;
        let members = [];

        if (leaderboard_id) {
            //gets specific leaderboard
            leaderboard = await db.oneOrNone(
                `SELECT * FROM leaderboards WHERE leaderboard_id = $1`,
                [leaderboard_id]
            );

            //if leaderboard exists, gets time studied from user. gets members
            if (leaderboard) {
                members = await db.any(
                    `SELECT username, time_studied AS "timeStudied"
                     FROM leaderboard_members
                     WHERE leaderboard_id = $1
                     ORDER BY time_studied DESC`, //orders so that user w/most time is at the top
                    [leaderboard_id]
                );
            }
        } else {
            //gets any shared leaderboard if it's already created
            const leaderboard = await db.oneOrNone(
                `SELECT l.*  FROM leaderboards l JOIN leaderboard_members m
            ON m.leaderboard_id = l.leaderboard_id WHERE m.username = $1
            LIMIT 1`,
                [req.session.user.username]
            );

            //gets time studied of members of leaderboard
            if (leaderboard) {
                members = await db.any(
                    `SELECT username, time_studied AS "timeStudied"
                     FROM leaderboard_members
                     WHERE leaderboard_id = $1
                     ORDER BY time_studied DESC`,
                    [leaderboard.leaderboard_id]
                );
            }
        }
        //render page with data
        res.render('pages/leaderboard', {
            invite_requests,
            leaderboard,
            members,
            error: req.query.error
        });
    } catch (err) {
        console.error('Error loading leaderboard page:', err);
        res.render('pages/leaderboard', {
            error: 'Could not load leaderboard'
        });
    }
});

//submit study time
app.post('/leaderboard/:leaderboard_id/submit-time', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { leaderboard_id } = req.params;
    const { time } = req.body;

    try {
        //update user's time studied
        await db.none(
            `UPDATE leaderboard_members 
             SET time_studied = time_studied + $1
             WHERE leaderboard_id = $2 AND username = $3`,
            [time, leaderboard_id, req.session.user.username]
        );

        //redirects back to specific leaderboard
        res.redirect(`/leaderboard?leaderboard_id=${leaderboard_id}`);
    } catch (error) {
        console.error('Error submitting time:', error);
        res.redirect(`/leaderboard?leaderboard_id=${leaderboard_id}&error=Could not submit time`);
    }
});

//delete route for button removing leaderboard
app.post('/leaderboard/:leaderboard_id/delete', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { leaderboard_id } = req.params;

    try {
        //delete in this order (order of the sql tables) 
        await db.none('DELETE FROM leaderboard_invites WHERE leaderboard_id = $1', [leaderboard_id]);
        await db.none('DELETE FROM leaderboard_members WHERE leaderboard_id = $1', [leaderboard_id]);
        await db.none('DELETE FROM leaderboards WHERE leaderboard_id = $1', [leaderboard_id]);

        res.redirect('/leaderboard?success=Leaderboard deleted successfully');
    } catch (error) {
        console.error('Error deleting leaderboard:', error);
        res.redirect(`/leaderboard?leaderboard_id=${leaderboard_id}&error=Could not delete leaderboard`);
    }
});

//leaderboard invite
app.post('/leaderboard/invite', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { friend_username } = req.body;

    if (!friend_username) {
        return res.redirect('/friends?error=Missing info');
    }

    try {
        //check if friend exists
        const friendExists = await db.oneOrNone(
            'SELECT 1 FROM users WHERE username = $1',
            [friend_username]
        );
        if (!friendExists) {
            return res.redirect('/friends?error=Friend DNE');
        }

        //no duplicate invites
        const existing = await db.one(
            `SELECT COUNT(*)::int AS count FROM leaderboard_invites
            WHERE from_user = $1 AND to_user = $2
            AND status = 'pending'`,
            [req.session.user.username, friend_username]
        );
        if (existing.count > 0) {
            return res.redirect('/friends?error=Cannot send invite twice');
        }

        //creates new leaderboard
        const leaderboard = await db.one(
            `INSERT INTO leaderboards (name, created_by) 
             VALUES ($1, $2) 
             RETURNING leaderboard_id`,
            [`${req.session.user.username} & ${friend_username}'s Leaderboard`,
            req.session.user.username]
        );

        //adds both users as members
        await db.none(
            `INSERT INTO leaderboard_members (leaderboard_id, username)
             VALUES ($1, $2), ($1, $3)`,
            [leaderboard.leaderboard_id, req.session.user.username, friend_username]
        );

        //creates invite 
        await db.none(
            `INSERT INTO leaderboard_invites 
             (leaderboard_id, from_user, to_user)
             VALUES ($1, $2, $3)`,
            [leaderboard.leaderboard_id, req.session.user.username, friend_username]
        );

        res.redirect('/friends?success=invite_sent');
        return;
    } catch (error) {
        console.error('Error creating leaderboard:', error);
        res.redirect('/friends?error=Could not create leaderboard');
    }
});

//accept invite
app.post('/leaderboard/invite/accept', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { invite_id } = req.body;
    try {

        //invite details
        const invite = await db.one(
            `SELECT leaderboard_id, to_user 
             FROM leaderboard_invites 
             WHERE invite_id = $1`,
            [invite_id]
        );

        //check if user is already a member of leaderboard
        const existingMember = await db.oneOrNone(
            `SELECT 1 FROM leaderboard_members 
             WHERE leaderboard_id = $1 AND username = $2`,
            [invite.leaderboard_id, invite.to_user]
        );

        //invite status update
        await db.none(
            `UPDATE leaderboard_invites SET status = 'accepted' WHERE invite_id = $1`,
            [invite_id]
        );

        //if user is not an existing member, insert them in leaderboard
        if (!existingMember) {
            await db.none(
                `INSERT INTO leaderboard_members (leaderboard_id, username)
                 VALUES ($1, $2)`,
                [invite.leaderboard_id, invite.to_user]
            );
        }

        //redirect to leaderboard page with leaderboard-id
        res.redirect(`/leaderboard?leaderboard_id=${invite.leaderboard_id}`);
    } catch (error) {
        console.error('Error accepting invite:', error);
        res.redirect('/friends?error=Could not accept invite');
    }
});

//decline invite
app.post('/leaderboard/invite/decline', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { invite_id } = req.body;
    try {
        //update status to declined
        await db.none(
            `UPDATE leaderboard_invites SET status = 'declined' WHERE invite_id = $1`, [invite_id]
        );
        res.redirect('/friends?success=invite_declined');
    } catch (error) {
        console.error('Error declining invite:', error);
        res.redirect('/friends?error=Could not decline invite');
    }
});

//view leaderboard button from friends page
app.get('/view_leaderboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    try {
        //check if user has existing leaderboards
        const leaderboard = await db.oneOrNone(
            `SELECT l.leaderboard_id 
             FROM leaderboards l
             JOIN leaderboard_members m ON l.leaderboard_id = m.leaderboard_id
             WHERE m.username = $1
             LIMIT 1`,
            [req.session.user.username]
        );

        if (leaderboard) {
            //links button to existing leaderboard id
            return res.redirect(`/leaderboard?leaderboard_id=${leaderboard.leaderboard_id}`);
        } else {
            //redirects to general leaderboard page
            return res.redirect('/leaderboard');
        }
    } catch (error) {
        console.error('Error finding leaderboard:', error);
        res.redirect('/leaderboard?error=Could not load leaderboard');
    }
});


// *****************************************************
//                    About Us
// *****************************************************


app.get('/aboutus', (req, res) => {
    res.render('pages/aboutus')

});

