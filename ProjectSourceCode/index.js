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

// *****************************************************
//                    API Routes
// *****************************************************

app.get('/', (req, res) => {
    res.render('pages/home');
});

app.get('/welcome', (req, res) => {
    res.json({status: 'success', message: 'Welcome!'});
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
  
    // Validate that both username and password are provided
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
  
    // Simulating successful registration without database logic
    res.status(201).json({ message: 'User registered successfully!' });
  });

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });
