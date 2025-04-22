-- Insert Test User
INSERT INTO users (username, password, coins) VALUES
('testuser', '$2a$10$4cVIPRhM9m7yx1ahCbor9.gEjGHuPyH064X8JqWfl8o/GQBH4.hqe', 2125);

-- Insert categories associated with the testuser
INSERT INTO categories (category_name, category_color, username) VALUES
('Math', '#0000FF', 'testuser'),
('English', '#FF0000', 'testuser');

-- Insert Study Sessions 
INSERT INTO sessions (category_id, username, start_time, end_time, total_minutes) 
VALUES 
(1, 'testuser', '2025-04-21 10:00:00', '2025-04-21 12:00:00', 120),
(2, 'testuser', '2025-04-23 10:00:00', '2025-04-21 12:00:00', 120);
