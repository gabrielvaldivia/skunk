# Quick Start Guide

## Option 1: Interactive Setup Script

Run the helper script to guide you through creating your `.env` file:

```bash
cd web
node setup-firebase.js
```

This will ask you for each Firebase config value and create the `.env` file automatically.

## Option 2: Manual Setup

1. **Get your Firebase config:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create/select your project
   - Click the Web icon (`</>`) to add a web app
   - Copy the config values

2. **Create `.env` file:**
   ```bash
   cd web
   cp .env.example .env
   ```

3. **Edit `.env` with your Firebase values**

4. **Set up Firebase:**
   - Enable Realtime Database (see FIREBASE_SETUP.md)
   - Add security rules (see FIREBASE_SETUP.md)
   - Enable Google Sign-In (see FIREBASE_SETUP.md)

5. **Run the app:**
   ```bash
   npm run dev
   ```

## Where to Find Firebase Config Values

When you register your web app in Firebase Console, you'll see a config like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",              // → VITE_FIREBASE_API_KEY
  authDomain: "...",               // → VITE_FIREBASE_AUTH_DOMAIN
  databaseURL: "https://...",      // → VITE_FIREBASE_DATABASE_URL
  projectId: "...",                // → VITE_FIREBASE_PROJECT_ID
  storageBucket: "...",            // → VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "...",        // → VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:..."                   // → VITE_FIREBASE_APP_ID
};
```

Copy each value to the corresponding variable in your `.env` file.

For detailed setup instructions, see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).

