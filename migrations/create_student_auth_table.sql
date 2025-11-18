-- Create student_auth table for student login authentication
CREATE TABLE IF NOT EXISTS student_auth (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX (email),
  INDEX (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert dummy student auth data for testing
-- Password: student123 (plain text for development only)

INSERT INTO student_auth (student_id, email, password, is_active) 
VALUES 
(1, 'student1@email.com', 'student123', 1),
(2, 'student2@email.com', 'student123', 1),
(3, 'student3@email.com', 'student123', 1),
(4, 'student4@email.com', 'student123', 1),
(5, 'student5@email.com', 'student123', 1);
