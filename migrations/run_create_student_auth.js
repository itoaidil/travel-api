const db = require('../config/database');

console.log('🔄 Creating student_auth table...');

// Create table
const createTableSQL = `
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

db.query(createTableSQL, (err) => {
  if (err) {
    console.error('❌ Error creating table:', err.message);
    process.exit(1);
  }
  
  console.log('✅ Table student_auth created successfully!');
  
  // First, insert students if they don't exist
  const insertStudentsSQL = `
    INSERT IGNORE INTO students (id, user_id, full_name, student_id, university, address, emergency_contact)
    VALUES 
    (1, 1, 'Ahmad Rizki', 'STD001', 'Universitas Negeri Padang', 'Jl. Hamka No. 1 Padang', '081234567891'),
    (2, 2, 'Siti Nurhaliza', 'STD002', 'Universitas Andalas', 'Jl. Limau Manis Padang', '081234567893'),
    (3, 3, 'Budi Santoso', 'STD003', 'Institut Teknologi Padang', 'Jl. Gajah Mada Padang', '081234567895'),
    (4, 4, 'Dewi Lestari', 'STD004', 'Universitas Bung Hatta', 'Jl. Sumatra No. 106 Padang', '081234567897'),
    (5, 5, 'Rendra Pratama', 'STD005', 'Politeknik Negeri Padang', 'Jl. Kampus Politeknik Padang', '081234567899')
  `;
  
  db.query(insertStudentsSQL, (err, studResult) => {
    if (err) {
      console.log('⚠️  Note: Some students might already exist');
    } else {
      console.log(`✅ Students data ready!`);
    }
    
    // Insert dummy auth data
    const insertSQL = `
      INSERT INTO student_auth (student_id, email, password, is_active) 
      VALUES 
      (1, 'student1@email.com', 'student123', 1),
      (2, 'student2@email.com', 'student123', 1),
      (3, 'student3@email.com', 'student123', 1),
      (4, 'student4@email.com', 'student123', 1),
      (5, 'student5@email.com', 'student123', 1)
      ON DUPLICATE KEY UPDATE password = VALUES(password)
    `;
    
    db.query(insertSQL, (err, result) => {
      if (err) {
        console.error('❌ Error inserting data:', err.message);
        process.exit(1);
      }
      
      console.log(`✅ Student auth records ready!`);
      console.log('\n📋 Login credentials:');
      console.log('   Email: student1@email.com - student5@email.com');
      console.log('   Password: student123');
      process.exit(0);
    });
  });
});
