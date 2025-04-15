-- Insert Test User
INSERT INTO users (username, password, coins) VALUES
('testuser', '$2a$10$4cVIPRhM9m7yx1ahCbor9.gEjGHuPyH064X8JqWfl8o/GQBH4.hqe', 100);

-- Insert Calendar Event
INSERT INTO calendar_events (username, title, description, event_start, event_end) VALUES
('testuser', 'Study Math', 'Finish math homework', '2025-04-15 09:00:00', '2025-04-15 11:00:00'),
('testuser', 'Science Review', 'Review chapter 2', '2025-04-16 13:00:00', '2025-04-16 14:30:00');

-- Insert Study Sessions 
INSERT INTO sessions (username, start_time, end_time) VALUES
('testuser', '2025-04-15 09:00:00', '2025-04-15 11:00:00'),
('testuser', '2025-04-16 13:00:00', '2025-04-16 14:30:00');
