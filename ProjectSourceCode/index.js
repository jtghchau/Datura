const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');

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
    res.json({ status: 'success', message: 'Welcome!' });
});

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');


// FRIENDS PAGE
app.get('/friends', (req, res) => {
    res.render('pages/friends')

});

// ABOUT US PAGE
app.get('/aboutus', (req, res) => {
    res.render('pages/aboutus')

});