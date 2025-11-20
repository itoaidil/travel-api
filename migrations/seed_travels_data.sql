-- Seed travels data for Railway database
-- Make sure vehicles and pos exist first

-- Insert sample travels for existing vehicles
-- Assuming we have vehicles with IDs 1-12 based on previous seeding

INSERT INTO travels (po_id, vehicle_id, origin, destination, departure_time, arrival_time, price, status) VALUES
-- Jakarta to Bandung routes
(1, 1, 'Jakarta', 'Bandung', '2025-11-20 06:00:00', '2025-11-20 09:00:00', 75000, 'scheduled'),
(1, 2, 'Jakarta', 'Bandung', '2025-11-20 08:00:00', '2025-11-20 11:00:00', 75000, 'scheduled'),
(1, 3, 'Jakarta', 'Bandung', '2025-11-20 10:00:00', '2025-11-20 13:00:00', 75000, 'scheduled'),
(1, 4, 'Jakarta', 'Bandung', '2025-11-20 14:00:00', '2025-11-20 17:00:00', 75000, 'scheduled'),

-- Bandung to Jakarta routes
(1, 1, 'Bandung', 'Jakarta', '2025-11-20 12:00:00', '2025-11-20 15:00:00', 75000, 'scheduled'),
(1, 2, 'Bandung', 'Jakarta', '2025-11-20 15:00:00', '2025-11-20 18:00:00', 75000, 'scheduled'),

-- Jakarta to Surabaya routes
(2, 5, 'Jakarta', 'Surabaya', '2025-11-20 07:00:00', '2025-11-20 15:00:00', 150000, 'scheduled'),
(2, 6, 'Jakarta', 'Surabaya', '2025-11-20 14:00:00', '2025-11-20 22:00:00', 150000, 'scheduled'),

-- Surabaya to Jakarta routes
(2, 5, 'Surabaya', 'Jakarta', '2025-11-20 08:00:00', '2025-11-20 16:00:00', 150000, 'scheduled'),
(2, 6, 'Surabaya', 'Jakarta', '2025-11-20 16:00:00', '2025-11-21 00:00:00', 150000, 'scheduled'),

-- Jakarta to Semarang routes
(3, 9, 'Jakarta', 'Semarang', '2025-11-20 06:30:00', '2025-11-20 13:00:00', 120000, 'scheduled'),
(3, 10, 'Jakarta', 'Semarang', '2025-11-20 13:00:00', '2025-11-20 19:30:00', 120000, 'scheduled'),

-- Semarang to Jakarta routes
(3, 9, 'Semarang', 'Jakarta', '2025-11-20 07:00:00', '2025-11-20 13:30:00', 120000, 'scheduled'),
(3, 10, 'Semarang', 'Jakarta', '2025-11-20 14:00:00', '2025-11-20 20:30:00', 120000, 'scheduled'),

-- Bandung to Surabaya routes
(2, 7, 'Bandung', 'Surabaya', '2025-11-20 08:00:00', '2025-11-20 17:00:00', 180000, 'scheduled'),

-- Surabaya to Bandung routes
(2, 7, 'Surabaya', 'Bandung', '2025-11-20 09:00:00', '2025-11-20 18:00:00', 180000, 'scheduled'),

-- Additional routes for next few days
(1, 1, 'Jakarta', 'Bandung', '2025-11-21 06:00:00', '2025-11-21 09:00:00', 75000, 'scheduled'),
(1, 2, 'Jakarta', 'Bandung', '2025-11-21 08:00:00', '2025-11-21 11:00:00', 75000, 'scheduled'),
(1, 3, 'Jakarta', 'Bandung', '2025-11-22 06:00:00', '2025-11-22 09:00:00', 75000, 'scheduled'),
(2, 5, 'Jakarta', 'Surabaya', '2025-11-21 07:00:00', '2025-11-21 15:00:00', 150000, 'scheduled');
