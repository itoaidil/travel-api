-- Add password column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password VARCHAR(255) NOT NULL DEFAULT 'password123';

-- Update existing users to have a default password
UPDATE users SET password = 'password123' WHERE password IS NULL OR password = '';
