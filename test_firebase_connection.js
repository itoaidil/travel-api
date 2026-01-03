require('dotenv').config();
const admin = require('firebase-admin');

console.log('🔍 Testing Firebase Configuration...\n');

// Check if credentials exist
console.log('Environment Variables Check:');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing');
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing');
console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Missing');
console.log('');

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error('❌ Missing Firebase credentials');
  process.exit(1);
}

// Check private key format
console.log('Private Key Format Check:');
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
console.log('- Contains BEGIN marker:', privateKey.includes('BEGIN PRIVATE KEY') ? '✅' : '❌');
console.log('- Contains END marker:', privateKey.includes('END PRIVATE KEY') ? '✅' : '❌');
console.log('- Has newline chars (\\n):', privateKey.includes('\\n') ? '✅' : '❌');
console.log('- Key length:', privateKey.length, 'chars');
console.log('');

// Try to initialize Firebase
console.log('Attempting Firebase Initialization...');
try {
  const processedKey = privateKey.replace(/\\n/g, '\n');
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: processedKey,
    }),
  });
  
  console.log('✅ Firebase Admin initialized successfully!');
  console.log('');
  console.log('🎉 All checks passed! Firebase is configured correctly.');
  process.exit(0);
} catch (error) {
  console.error('❌ Firebase initialization failed:');
  console.error('Error:', error.message);
  console.error('');
  console.error('Troubleshooting:');
  console.error('1. Make sure private key includes -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----');
  console.error('2. Newlines should be \\n (backslash-n), not actual newlines');
  console.error('3. Copy the entire private_key value from Firebase service account JSON');
  process.exit(1);
}
