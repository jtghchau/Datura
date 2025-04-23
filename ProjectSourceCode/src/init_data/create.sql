-- User
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL,
    coins INTEGER DEFAULT 0
);

-- Categories
CREATE TABLE categories (
    category_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    category_name TEXT NOT NULL,
    category_color VARCHAR(60) NOT NULL, 
    username VARCHAR(50), 
    FOREIGN KEY (username) REFERENCES users(username)
);


-- Study
CREATE TABLE sessions (
    session_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    category_id INTEGER REFERENCES categories(category_id) ON DELETE CASCADE,
    username VARCHAR(50),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    total_minutes INTEGER,
    FOREIGN KEY (username) REFERENCES users(username)
);

-- Clothes/Store
CREATE TABLE clothing_items (
    item_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    cost INTEGER NOT NULL,
    category TEXT NOT NULL,
    image_path TEXT NOT NULL
);

CREATE TABLE user_clothing (
    username VARCHAR(50),
    item_id INTEGER,
    PRIMARY KEY (username, item_id),
    FOREIGN KEY (username) REFERENCES users(username),
    FOREIGN KEY (item_id) REFERENCES clothing_items(item_id)
);

CREATE TABLE equipped_items (
    username VARCHAR(50) PRIMARY KEY,
    head_item_id INTEGER,
    body_item_id INTEGER,
    pants_item_id INTEGER,
    FOREIGN KEY (username) REFERENCES users(username),
    FOREIGN KEY (head_item_id) REFERENCES clothing_items(item_id),
    FOREIGN KEY (body_item_id) REFERENCES clothing_items(item_id),
    FOREIGN KEY (pants_item_id) REFERENCES clothing_items(item_id)
);


-- Notes
CREATE TABLE study_notes (
    note_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    username VARCHAR(50),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pos_left INTEGER DEFAULT 0,  -- Horizontal position of the note
    pos_top INTEGER DEFAULT 0,   -- Vertical position of the note
    FOREIGN KEY (username) REFERENCES users(username)
);

-- Friends
CREATE TABLE friends (
    username VARCHAR(50),
    friend_username VARCHAR(50),
    status TEXT CHECK(status IN ('pending', 'accepted')) DEFAULT 'pending',
    PRIMARY KEY (username, friend_username),
    FOREIGN KEY (username) REFERENCES users(username),
    FOREIGN KEY (friend_username) REFERENCES users(username)
);


-- Leaderboards
CREATE TABLE leaderboards (
    leaderboard_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    created_by VARCHAR(50),
    status TEXT CHECK(status IN ('pending', 'accepted')) DEFAULT 'pending',
    FOREIGN KEY (created_by) REFERENCES users(username)
);


CREATE TABLE leaderboard_members (
    leaderboard_id INTEGER,
    username VARCHAR(50),
    time_studied   INTEGER DEFAULT 0,
    PRIMARY KEY (leaderboard_id, username),
    FOREIGN KEY (leaderboard_id) REFERENCES leaderboards(leaderboard_id),
    FOREIGN KEY (username) REFERENCES users(username)
);

CREATE TABLE leaderboard_invites (
  invite_id      SERIAL PRIMARY KEY,
  leaderboard_id INTEGER NOT NULL REFERENCES leaderboards(leaderboard_id),
  from_user      VARCHAR(50) NOT NULL REFERENCES users(username),
  to_user        VARCHAR(50) NOT NULL REFERENCES users(username),
  status         TEXT CHECK (status IN ('pending','accepted','declined')) DEFAULT 'pending'
);
