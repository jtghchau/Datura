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


//FRIENDS

app.get('/friends', (req, res) => {
    res.render('pages/friends')

});



app.post('/friends/add', async (req, res) => {
    const username = req.body;

    if (!username || !req.session.user) {
        return res.status(400);
    }

    try {
        const query = `
        INSERT INTO friends (user_id, friend_username)
        VALUES ($1, $2)
        RETURNING *;`;
        const result = await db.one(query, [req.session.user.user_id, username]);
        console.log(`Friend added successfully`);
        res.redirect('/friends');
    } catch (error) {
        console.error(error);
        res.status(400);
    }
});
