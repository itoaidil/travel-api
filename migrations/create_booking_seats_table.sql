-- Create booking_seats table to store selected seats for each booking
CREATE TABLE IF NOT EXISTS booking_seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  seat_number INT NOT NULL,
  passenger_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
