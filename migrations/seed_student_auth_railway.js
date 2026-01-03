const db = require('../config/database');

console.log('🌱 Seeding student_auth table for Railway...');

// First check if students exist, if not create them
const checkStudents = `SELECT COUNT(*) as count FROM students`;

db.query(checkStudents, (err, results) => {
  if (err) {
    console.error('❌ Error checking students:', err.message);
    process.exit(1);
  }
  
  const studentCount = results[0].count;
  
  if (studentCount === 0) {
    console.log('📝 No students found, creating sample students...');
    
    // Insert sample students
    const insertStudents = `
      INSERT INTO students (id, user_id, full_name, student_id, university, address, emergency_contact)
      VALUES 
      (1, 1, 'Test Student', 'STD001', 'Universitas Test', 'Jl. Test No. 1', '081234567890'),
      (2, 2, 'Demo User', 'STD002', 'Universitas Demo', 'Jl. Demo No. 2', '081234567891')
    `;
    
    db.query(insertStudents, (err2) => {
      if (err2 && !err2.message.includes('Duplicate entry')) {
        console.error('❌ Error inserting students:', err2.message);
        process.exit(1);
      }
      
      console.log('✅ Sample students created');
      seedAuth();
    });
  } else {
    console.log(`✅ Found ${studentCount} students in database`);
    seedAuth();
  }
});

function seedAuth() {
  // Insert auth data
  const insertAuth = `
    INSERT INTO student_auth (student_id, email, password, is_active) 
    VALUES 
    (1, 'a@gmail.com', '123456', 1),
    (1, 'student1@email.com', 'student123', 1),
    (2, 'student2@email.com', 'student123', 1)
    ON DUPLICATE KEY UPDATE password = VALUES(password), is_active = VALUES(is_active)
  `;
  
  db.query(insertAuth, (err, result) => {
    if (err) {
      console.error('❌ Error seeding auth:', err.message);
      process.exit(1);
    }
    
    console.log('✅ Student auth records seeded successfully!');
    console.log('\n📋 Available login credentials:');
    console.log('   1. Email: a@gmail.com | Password: 123456');
    console.log('   2. Email: student1@email.com | Password: student123');
    console.log('   3. Email: student2@email.com | Password: student123');
    console.log('\n✨ You can now login to the app!');
    
    db.end();
    process.exit(0);
  });
}
