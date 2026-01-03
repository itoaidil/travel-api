// Test OTP System Locally
// Run: node test_otp_system.js

require('dotenv').config();
const { generateOTP, sendOTPEmail } = require('./services/emailService');

console.log('\n🧪 Testing OTP Email Service\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Test 1: Generate OTP
console.log('\n1️⃣  Testing OTP Generation...');
const otp1 = generateOTP();
const otp2 = generateOTP();
const otp3 = generateOTP();

console.log(`   Generated OTP 1: ${otp1} (length: ${otp1.length})`);
console.log(`   Generated OTP 2: ${otp2} (length: ${otp2.length})`);
console.log(`   Generated OTP 3: ${otp3} (length: ${otp3.length})`);
console.log(`   ✅ All OTPs are 6 digits: ${otp1.length === 6 && otp2.length === 6 && otp3.length === 6}`);

// Test 2: Email Mode
console.log('\n2️⃣  Testing Email Mode...');
console.log(`   Current EMAIL_MODE: ${process.env.EMAIL_MODE || 'testing (default)'}`);

// Test 3: Send Test Email
console.log('\n3️⃣  Testing Email Sending...');
const testEmail = 'test@example.com';
const testOTP = generateOTP();

sendOTPEmail(testEmail, testOTP)
  .then(() => {
    console.log('   ✅ Email sent successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests passed!\n');
    
    console.log('📝 Next Steps:');
    console.log('   1. Run database migration: mysql < migrations/create_otp_table.sql');
    console.log('   2. Test API endpoint: POST /api/auth/register');
    console.log('   3. Check console for OTP code');
    console.log('   4. Test verification: POST /api/auth/verify-otp\n');
    
    process.exit(0);
  })
  .catch((error) => {
    console.log('   ❌ Error sending email:', error.message);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Test failed. Check email configuration.\n');
    process.exit(1);
  });
