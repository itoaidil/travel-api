-- Migration: Create vehicle_schedules table
-- This table stores departure schedules for each vehicle

CREATE TABLE IF NOT EXISTS vehicle_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  destination VARCHAR(255) NOT NULL,
  departure_times JSON NOT NULL COMMENT 'Array of departure times in HH:MM format, e.g. ["06:00", "09:00", "14:00", "17:00"]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  INDEX idx_vehicle_destination (vehicle_id, destination),
  INDEX idx_active (is_active)
);

-- Sample data for testing
INSERT INTO vehicle_schedules (vehicle_id, destination, departure_times, is_active) 
VALUES 
  (1, 'Jakarta', '["06:00", "09:00", "14:00", "17:00"]', TRUE),
  (2, 'Bandung', '["07:00", "10:00", "15:00"]', TRUE);

-- Query example: Get all active schedules for a vehicle
-- SELECT * FROM vehicle_schedules WHERE vehicle_id = 1 AND is_active = TRUE;

-- Query example: Get vehicles with schedules for specific destination
-- SELECT v.*, vs.departure_times 
-- FROM vehicles v 
-- JOIN vehicle_schedules vs ON v.id = vs.vehicle_id 
-- WHERE vs.destination = 'Jakarta' AND vs.is_active = TRUE;
