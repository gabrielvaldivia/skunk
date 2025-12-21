#!/usr/bin/env node

/**
 * Firebase Setup Helper Script
 * This script helps you set up your Firebase configuration
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupFirebase() {
  console.log('\n🔥 Firebase Setup Helper\n');
  console.log('You\'ll need to get these values from Firebase Console:');
  console.log('1. Go to https://console.firebase.google.com/');
  console.log('2. Create a project (if you haven\'t)');
  console.log('3. Click the Web icon (</>) to register your app');
  console.log('4. Copy the config values\n');
  
  console.log('Let\'s get your Firebase configuration values:\n');

  const apiKey = await question('API Key: ');
  const authDomain = await question('Auth Domain (e.g., your-project.firebaseapp.com): ');
  const databaseURL = await question('Database URL (e.g., https://your-project-default-rtdb.firebaseio.com/): ');
  const projectId = await question('Project ID: ');
  const storageBucket = await question('Storage Bucket (e.g., your-project.appspot.com): ');
  const messagingSenderId = await question('Messaging Sender ID: ');
  const appId = await question('App ID: ');

  // Ensure database URL ends with /
  const dbURL = databaseURL.endsWith('/') ? databaseURL : databaseURL + '/';

  const envContent = `VITE_FIREBASE_API_KEY=${apiKey}
VITE_FIREBASE_AUTH_DOMAIN=${authDomain}
VITE_FIREBASE_DATABASE_URL=${dbURL}
VITE_FIREBASE_PROJECT_ID=${projectId}
VITE_FIREBASE_STORAGE_BUCKET=${storageBucket}
VITE_FIREBASE_MESSAGING_SENDER_ID=${messagingSenderId}
VITE_FIREBASE_APP_ID=${appId}
`;

  const envPath = path.join(__dirname, '.env');
  
  console.log('\n📝 Creating .env file...\n');
  console.log('Configuration:');
  console.log(envContent);

  const confirm = await question('\nDoes this look correct? (y/n): ');
  
  if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ .env file created successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Make sure you\'ve enabled Realtime Database in Firebase Console');
    console.log('2. Set up the security rules (see FIREBASE_SETUP.md)');
    console.log('3. Enable Google Sign-In in Authentication → Sign-in method');
    console.log('4. Run: npm run dev');
  } else {
    console.log('\n❌ Setup cancelled. Run the script again when ready.');
  }

  rl.close();
}

setupFirebase().catch(console.error);

