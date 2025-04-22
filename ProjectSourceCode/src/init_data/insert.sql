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
(2, 'testuser', '2025-04-23 10:00:00', '2025-04-23 12:00:00', 120);

-- Insert clothes
INSERT INTO clothing_items (name, category, image_path, cost) VALUES
('Bow', 'head', '../images/clothing/bow.png', 50),
('Sunglasses', 'head', '../images/clothing/sunglasses.png', 75),
('Glasses', 'head', '../images/clothing/glasses.png', 100),
('Moustache', 'head', '../images/clothing/moustache.png', 150),

('Blue Shirt', 'body', '../images/clothing/blueShirt.png', 50),
('Pink Shirt', 'body', '../images/clothing/pinkShirt.png', 75),
('Grey Shirt', 'body', '../images/clothing/greyShirt.png', 100),
('Lavender Shirt', 'body', '../images/clothing/lavShirt.png', 150),

('Pink Skirt', 'pants', '../images/clothing/pinkSkirt.png', 50),
('Maroon Skirt', 'pants', '../images/clothing/marSkirt.png', 75),
('Blue Skirt', 'pants', '../images/clothing/bluSkirt.png', 100),
('Lavender Skirt', 'pants', '../images/clothing/lavSkirt.png', 150);
