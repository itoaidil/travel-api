#!/bin/bash
# Script to seed student_auth table in Railway MySQL

echo "🌱 Seeding student_auth table..."

# SQL commands
SQL_SEED="
-- Insert sample student if not exists
INSERT IGNORE INTO students (id, user_id, full_name, student_id, university, address, emergency_contact)
VALUES (1, 1, 'Test Student', 'STD001', 'Universitas Test', 'Jl. Test No. 1', '081234567890');

-- Insert auth credentials
INSERT INTO student_auth (student_id, email, password, is_active) 
VALUES 
(1, 'a@gmail.com', '123456', 1),
(1, 'student1@email.com', 'student123', 1)
ON DUPLICATE KEY UPDATE password = VALUES(password), is_active = VALUES(is_active);

-- Show created records
SELECT email, is_active FROM student_auth;
"

echo "$SQL_SEED"
echo ""
echo "✅ Copy SQL above and run in Railway MySQL query console"
echo ""
echo "Or run this via Railway CLI:"
echo "railway run -- node -e \"require('./config/database').query('INSERT INTO student_auth (student_id, email, password) VALUES (1, \\\"a@gmail.com\\\", \\\"123456\\\") ON DUPLICATE KEY UPDATE password=VALUES(password)', (e,r) => { console.log(e||'✅ Done'); process.exit(e?1:0); })\""
