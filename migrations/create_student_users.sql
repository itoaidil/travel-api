-- Insert dummy student users for testing
-- Password: student123 (plain text for development only)

-- Student 1
INSERT INTO users (email, password, role, phone, is_active) 
VALUES ('student1@email.com', 'student123', 'student', '081234567890', 1);

SET @user_id1 = LAST_INSERT_ID();

INSERT INTO students (user_id, full_name, student_id, university, address, emergency_contact)
VALUES (@user_id1, 'Ahmad Rizki', 'STD001', 'Universitas Negeri Padang', 'Jl. Hamka No. 1 Padang', '081234567891');

-- Student 2
INSERT INTO users (email, password, role, phone, is_active) 
VALUES ('student2@email.com', 'student123', 'student', '081234567892', 1);

SET @user_id2 = LAST_INSERT_ID();

INSERT INTO students (user_id, full_name, student_id, university, address, emergency_contact)
VALUES (@user_id2, 'Siti Nurhaliza', 'STD002', 'Universitas Andalas', 'Jl. Limau Manis Padang', '081234567893');

-- Student 3
INSERT INTO users (email, password, role, phone, is_active) 
VALUES ('student3@email.com', 'student123', 'student', '081234567894', 1);

SET @user_id3 = LAST_INSERT_ID();

INSERT INTO students (user_id, full_name, student_id, university, address, emergency_contact)
VALUES (@user_id3, 'Budi Santoso', 'STD003', 'Institut Teknologi Padang', 'Jl. Gajah Mada Padang', '081234567895');

-- Student 4
INSERT INTO users (email, password, role, phone, is_active) 
VALUES ('student4@email.com', 'student123', 'student', '081234567896', 1);

SET @user_id4 = LAST_INSERT_ID();

INSERT INTO students (user_id, full_name, student_id, university, address, emergency_contact)
VALUES (@user_id4, 'Dewi Lestari', 'STD004', 'Universitas Bung Hatta', 'Jl. Sumatra No. 106 Padang', '081234567897');

-- Student 5
INSERT INTO users (email, password, role, phone, is_active) 
VALUES ('student5@email.com', 'student123', 'student', '081234567898', 1);

SET @user_id5 = LAST_INSERT_ID();

INSERT INTO students (user_id, full_name, student_id, university, address, emergency_contact)
VALUES (@user_id5, 'Rendra Pratama', 'STD005', 'Politeknik Negeri Padang', 'Jl. Kampus Politeknik Padang', '081234567899');
