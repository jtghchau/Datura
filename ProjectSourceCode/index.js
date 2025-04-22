const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server

const app = express();
const PORT = 3000;

// initialize session variables
app.use(
  session({
      secret: process.env.SESSION_SECRET,
      saveUninitialized: false,
      resave: false,
  })
);

app.engine('hbs', exphbs.engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());

// *****************************************************
//                    API Routes
// *****************************************************

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

app.get('/', (req, res) => {
    res.render('pages/register');
});

app.get('/register', (req, res) => {
    res.render('pages/register');
});

app.get('/notes', requireLogin, (req, res) => {
    res.render('pages/notes');
});

app.get('/calendar', requireLogin, (req, res) => {
    res.render('pages/calendar');
});

// app.get('/friends', requireLogin, (req, res) => {
//     res.render('pages/friends');
// });

app.get('/login', (req, res) => {
    res.render('pages/login');
});

app.get('/welcome', (req, res) => {
    res.json({ status: 'success', message: 'Welcome!' });
});

app.get('/settings', (req, res) => {
    res.render('pages/settings');
});

app.get('/aboutus', requireLogin, (req, res) => {
    res.render('pages/aboutus'); // assuming your HBS file is in views/pages/profile.hbs
});

app.get('/changepassword', requireLogin, (req, res) => {
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

app.engine('hbs', hbs.engine); // <- this one registers the helpers
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// database configuration
const dbConfig = {
    host: process.env.POSTGRES_HOST, // the database server
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

  const { title, start_time, end_time, total_minutes } = req.body;

  if (!start_time || !end_time || !title || total_minutes === undefined) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const start = new Date(start_time);
  const end = new Date(end_time);

  try {
    // Look up or create category
    const category = await db.oneOrNone(
      'SELECT category_id FROM categories WHERE category_name = $1 AND username = $2',
      [title, user.username]
    );

    if (!category) {
      return res.status(400).json({ error: 'Category not found for subject: ' + title });
    }

    // Insert the session into the sessions table
    await db.none(
      `INSERT INTO sessions (username, category_id, start_time, end_time, total_minutes)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.username,
        category.category_id,
        new Date(start_time).toISOString(),
        new Date(end_time).toISOString(),
        total_minutes
      ]
    );

    // Update the user's coins based on the total minutes of the session
    const coinsEarned = total_minutes;
    await db.none(
      `UPDATE users
       SET coins = coins + $1
       WHERE username = $2`,
      [coinsEarned, user.username]
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
      `SELECT 
         s.session_id,
         c.category_name AS title,
         to_char(s.start_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start,
         to_char(s.end_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end,
         c.category_color AS color,
         s.total_minutes
       FROM sessions s
       JOIN categories c ON s.category_id = c.category_id
       WHERE s.username = $1`,
      [user.username]
    );

    res.json(sessions);
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

//route to EDIT a session
app.patch('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  const { category_id, start_time, end_time, total_minutes } = req.body;

  console.log(`PATCH /api/sessions/${id}`, req.body);

  try {
    await db.none(
      `UPDATE sessions SET 
        category_id = $1,
        start_time = $2, 
        end_time = $3, 
        total_minutes = $4 
      WHERE session_id = $5`,
      [category_id, new Date(start_time).toISOString(), new Date(end_time).toISOString(), total_minutes, id]
    );    
    res.sendStatus(200);
  } catch (err) {
    console.error("Update error:", err);
    res.sendStatus(500);
  }
});

//route to DELETE a session
app.delete('/api/sessions/:id', async (req, res) => {
  const sessionId = req.params.id;

  try {
    await db.none('DELETE FROM sessions WHERE session_id = $1', [sessionId]);
    res.sendStatus(204); // No Content
  } catch (err) {
    console.error('Error deleting session:', err);
    res.sendStatus(500);
  }
});







// *****************************************************
//               APIs for categories
// *****************************************************

app.post('/api/categories', async (req, res) => {
  const user = req.session.user;

  const { category_name, category_color } = req.body;

  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (!category_name || !category_color) {
    return res.status(400).json({ error: 'Missing category name or color' });
  }

  try {
    const newCategory = await db.one(
      `INSERT INTO categories (username, category_name, category_color)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user.username, category_name, category_color]
    );

    res.status(201).json(newCategory);
  } catch (err) {
    console.error('Error inserting category:', err);
    res.status(500).json({ error: 'Could not insert category' });
  }
});


app.get('/api/categories', async (req, res) => {
  const user = req.session.user;

  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const categories = await db.any(
      'SELECT * FROM categories WHERE username = $1',
      [user.username]
    );
    res.json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Could not fetch categories' });
  }
});

//for editing categories
app.put('/api/categories/:id', async (req, res) => {
  const user = req.session.user;
  const { id } = req.params;
  const { category_name, category_color } = req.body;

  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const updated = await db.one(
      `UPDATE categories
       SET category_name = $1, category_color = $2
       WHERE category_id = $3 AND username = $4
       RETURNING *`,
      [category_name, category_color, id, user.username]
    );
    res.json(updated);
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ error: 'Could not update category' });
  }
});

//for deleting categories
app.delete('/api/categories/:id', (req, res) => {
  const categoryId = req.params.id;
  console.log(`Deleting category with ID: ${categoryId}`);

  // Use pg-promise to execute the delete query
  db.none('DELETE FROM categories WHERE category_id = $1', [categoryId])
    .then(() => {
      res.json({ success: true });
    })
    .catch(err => {
      console.error('Error deleting category:', err);
      res.status(500).json({ error: 'Failed to delete category' });
    });
});

app.get('/api/categories/:id', async (req, res) => {
  const user = req.session.user;
  const id = req.params.id;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const category = await db.oneOrNone(
      'SELECT category_id, category_name FROM categories WHERE category_id = $1 AND username = $2',
      [id, user.username]
    );

    if (category) {
      res.json(category);
    } else {
      res.status(404).json({ error: 'Category not found' });
    }
  } catch (err) {
    console.error('Error validating category:', err);
    res.status(500).json({ error: 'Database error' });
  }
});





// *****************************************************
//                    Home
// *****************************************************
app.get('/home', async (req, res) => {
  const user = req.session.user;

  if (!user) return res.redirect('/register');

  try {
    const categories = await db.any(
      'SELECT category_id, category_name, category_color FROM categories WHERE username = $1',
      [user.username]
    );

    const result = await db.oneOrNone(
      'SELECT coins FROM users WHERE username = $1',
      [user.username]
    );

    const coins = result ? result.coins : 0;

    res.render('pages/home', {
      categories,
      coins
    });
  } catch (err) {
    console.error('Error fetching data for home page:', err);
    res.render('pages/home', {
      categories: [],
      coins: 0
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

      // add only the inviter as a member
      //prior it caused leaderboard to show up on the pending user
      await db.none(
        `INSERT INTO leaderboard_members (leaderboard_id, username)
        VALUES ($1, $2)`,
        [leaderboard.leaderboard_id, req.session.user.username]
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
      res.redirect(`/leaderboard/${invite.leaderboard_id}`);
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
const username = req.session.user.username;

const leaderboards = await db.any(`
  SELECT lb.leaderboard_id AS id, lb.name
  FROM leaderboard_members lbm
  JOIN leaderboards lb ON lb.leaderboard_id = lbm.leaderboard_id
  WHERE lbm.username = $1
`, [username]);

const invite_requests = await db.any(`
  SELECT li.invite_id, li.from_user, lb.name AS leaderboard_name
  FROM leaderboard_invites li
  JOIN leaderboards lb ON li.leaderboard_id = lb.leaderboard_id
  WHERE li.to_user = $1 AND li.status = 'pending'
`, [username]);

res.render('pages/leaderboard', { leaderboards, invite_requests });
});

//Route to leaderboards
app.get('/leaderboard/:id', async (req, res) => {
const leaderboardId = req.params.id;
const username = req.session.user.username;

const member = await db.oneOrNone(`
  SELECT * FROM leaderboard_members
  WHERE leaderboard_id = $1 AND username = $2
`, [leaderboardId, username]);

if (!member) {
  return res.status(403).send("You're not in this leaderboard.");
}

const leaderboard = await db.one(`
  SELECT * FROM leaderboards WHERE leaderboard_id = $1
`, [leaderboardId]);

const members = await db.any(`
  SELECT username, time_studied
  FROM leaderboard_members
  WHERE leaderboard_id = $1
`, [leaderboardId]);

res.render('pages/leaderboard_view', {
  leaderboard,
  members
});
});

app.post('/leaderboard/:id/delete', async (req, res) => {
const leaderboardId = req.params.id;
const username = req.session.user.username;

const leaderboard = await db.oneOrNone(`
  SELECT * FROM leaderboards
  WHERE leaderboard_id = $1 AND created_by = $2
`, [leaderboardId, username]);

if (!leaderboard) {
  return res.status(403).send("You are not allowed to delete this leaderboard.");
}

try {
  await db.tx(async t => {
    await t.none('DELETE FROM leaderboard_members WHERE leaderboard_id = $1', [leaderboardId]);
    await t.none('DELETE FROM leaderboard_invites WHERE leaderboard_id = $1', [leaderboardId]);
    await t.none('DELETE FROM leaderboards WHERE leaderboard_id = $1', [leaderboardId]);
  });

  res.redirect('/view_leaderboard');
} catch (err) {
  console.error(err);
  res.redirect(`/leaderboard/${leaderboardId}?error=Failed to delete`);
}
});

app.post('/leaderboard/:id/submit-time', requireLogin, async (req, res) => {
const leaderboardId = req.params.id;
const username = req.session.user.username;
const minutes = parseInt(req.body.time);

try {
  await db.none(`
    UPDATE leaderboard_members
    SET time_studied = time_studied + $1
    WHERE leaderboard_id = $2 AND username = $3
  `, [minutes, leaderboardId, username]);

  res.redirect(`/leaderboard/${leaderboardId}`);
} catch (err) {
  console.error(err);
  res.redirect(`/leaderboard/${leaderboardId}?error=Failed to submit time`);
}
});


// *****************************************************
//                    Store
// *****************************************************
app.get('/store', async (req, res) => {
  const user = req.session.user;

  if (!user) return res.redirect('/register');

  try {
    const result = await db.oneOrNone(
      'SELECT coins FROM users WHERE username = $1',
      [user.username]
    );

    const coins = result ? result.coins : 0;

    res.render('pages/store', {
      coins
    });
  } catch (err) {
    console.error('Error fetching data for home page:', err);
    res.render('pages/home', {
      coins: 0
    });
  }
});

//get clothing category
app.get('/api/store/:category', async (req, res) => {
  const { category } = req.params;
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: 'Not logged in' });

  const username = user.username;

  try {
    const items = await db.any(`
      SELECT ci.item_id, ci.name, ci.image_path, ci.cost,
        uc.item_id IS NOT NULL AS owned,
        (
          (ci.category = 'head' AND ei.head_item_id = ci.item_id) OR
          (ci.category = 'body' AND ei.body_item_id = ci.item_id) OR
          (ci.category = 'pants' AND ei.pants_item_id = ci.item_id)
        ) AS equipped
      FROM clothing_items ci
      LEFT JOIN user_clothing uc
        ON ci.item_id = uc.item_id AND uc.username = $1
      LEFT JOIN equipped_items ei
        ON ei.username = $1
      WHERE ci.category = $2
    `, [username, category]);

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});



//buy clothes
app.post('/api/store/buy', async (req, res) => {
  const user = req.session.user;
  const { item_id } = req.body;

  if (!user || !item_id) {
    return res.status(400).json({ error: 'Missing item_id or user' });
  }

  const username = user.username;

  try {
    const item = await db.one('SELECT cost FROM clothing_items WHERE item_id = $1', [item_id]);
    const dbUser = await db.one('SELECT coins FROM users WHERE username = $1', [username]);

    if (dbUser.coins < item.cost) {
      return res.status(400).json({ error: 'Not enough coins' });
    }

    await db.tx(async t => {
      await t.none('UPDATE users SET coins = coins - $1 WHERE username = $2', [item.cost, username]);
      await t.none('INSERT INTO user_clothing (username, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [username, item_id]);
    });

    const updated = await db.one('SELECT coins FROM users WHERE username = $1', [username]);
    res.json({ success: true, coins: updated.coins });
  } catch (err) {
    console.error('Error occurred during buy operation:', err);
    res.status(500).json({ error: 'Buy failed' });
  }
});



//equip clothes
app.post('/api/store/equip', async (req, res) => {
  const user = req.session.user;
  const { item_id } = req.body;

  if (!user) return res.status(401).json({ error: 'Not logged in' });

  const username = user.username;

  try {
    const item = await db.one(`
      SELECT category FROM clothing_items WHERE item_id = $1
    `, [item_id]);

    const owned = await db.oneOrNone(`
      SELECT 1 FROM user_clothing WHERE username = $1 AND item_id = $2
    `, [username, item_id]);

    if (!owned) {
      return res.status(403).json({ error: 'Item not owned' });
    }

    const col = {
      head: 'head_item_id',
      body: 'body_item_id',
      pants: 'pants_item_id'
    }[item.category];

    if (!col) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    await db.none(`
      INSERT INTO equipped_items (username, ${col})
      VALUES ($1, $2)
      ON CONFLICT (username) DO UPDATE SET ${col} = $2
    `, [username, item_id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Equip error:', err);
    res.status(500).json({ error: 'Equip failed' });
  }
});


//UNequip clothes
app.post('/api/store/unequip', async (req, res) => {
  const user = req.session.user;
  const { category } = req.body;

  if (!user || !category) return res.status(400).json({ error: 'Missing category or user' });

  const username = user.username;

  try {
    // Check if the item is equipped by looking at the specific category columns
    let equippedItem;
    if (category === 'head') {
      equippedItem = await db.oneOrNone('SELECT 1 FROM equipped_items WHERE username = $1 AND head_item_id IS NOT NULL', [username]);
    } else if (category === 'body') {
      equippedItem = await db.oneOrNone('SELECT 1 FROM equipped_items WHERE username = $1 AND body_item_id IS NOT NULL', [username]);
    } else if (category === 'pants') {
      equippedItem = await db.oneOrNone('SELECT 1 FROM equipped_items WHERE username = $1 AND pants_item_id IS NOT NULL', [username]);
    }

    if (!equippedItem) {
      return res.status(400).json({ error: 'Item is not equipped' });
    }

    // Remove the equipped item from the corresponding category column
    if (category === 'head') {
      await db.none('UPDATE equipped_items SET head_item_id = NULL WHERE username = $1', [username]);
    } else if (category === 'body') {
      await db.none('UPDATE equipped_items SET body_item_id = NULL WHERE username = $1', [username]);
    } else if (category === 'pants') {
      await db.none('UPDATE equipped_items SET pants_item_id = NULL WHERE username = $1', [username]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unequip failed' });
  }
});



//get all the clothes a user has
app.get('/api/user/items', async (req, res) => {
  const user = req.session.user;

  if (!user) return res.status(401).json({ error: 'Not logged in' });

  const username = user.username;

  try {
    // Fetch all owned items
    const ownedRows = await db.any('SELECT item_id FROM user_clothing WHERE username = $1', [username]);

    // Fetch equipped items based on specific columns (head_item_id, body_item_id, pants_item_id)
    const equippedRows = await db.any(`
      SELECT head_item_id, body_item_id, pants_item_id 
      FROM equipped_items WHERE username = $1`, [username]);

    const owned = ownedRows.map(row => row.item_id);
    const equipped = equippedRows.length > 0 ? {
      head: equippedRows[0].head_item_id,
      body: equippedRows[0].body_item_id,
      pants: equippedRows[0].pants_item_id
    } : { head: null, body: null, pants: null };

    res.json({ owned, equipped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user items' });
  }
});
