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