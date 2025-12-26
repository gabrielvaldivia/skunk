# Firebase Setup Guide

This guide walks you through setting up Firebase for the Skunk web app.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** (or "Create a project" if this is your first)
3. Enter a project name (e.g., "skunk-web" or "skunk-app")
4. Click **"Continue"**
5. (Optional) Disable Google Analytics if you don't need it, or enable it if you do
6. Click **"Create project"**
7. Wait for the project to be created, then click **"Continue"**

## Step 2: Register Your Web App

1. In your Firebase project, click the **Web icon** (`</>`)
2. Enter an app nickname (e.g., "Skunk Web App")
3. (Optional) Check "Also set up Firebase Hosting" if you plan to host it
4. Click **"Register app"**
5. **Copy the Firebase configuration object** - you'll need these values:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```
6. Click **"Continue to console"**

## Step 3: Enable Firebase Realtime Database

1. In the Firebase Console, go to **Build** → **Realtime Database**
2. Click **"Create database"**
3. Choose a location (select the closest to your users)
4. Click **"Next"**
5. Choose **"Start in test mode"** (we'll add security rules next)
6. Click **"Enable"**

**Important:** You'll see your database URL at the top, something like:
`https://your-project-default-rtdb.firebaseio.com/`

This is the value you'll use for `VITE_FIREBASE_DATABASE_URL` in your `.env` file.

## Step 4: Set Up Security Rules

1. In Realtime Database, click the **"Rules"** tab
2. Replace the rules with:

```json
{
  "rules": {
    "games": {
      ".read": true,
      ".write": "auth != null",
      "$gameId": {
        ".write": "!data.exists() || data.child('createdByID').val() == auth.uid"
      }
    },
    "players": {
      ".read": true,
      ".write": "auth != null",
      "$playerId": {
        ".write": "!data.exists() || data.child('ownerID').val() == auth.uid"
      }
    },
    "matches": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

3. Click **"Publish"**

**What these rules do:**
- Anyone can read games, players, and matches
- Only authenticated users can write
- Users can only update/delete games they created
- Users can only update/delete players they own

## Step 5: Enable Google Sign-In Authentication

1. Go to **Build** → **Authentication**
2. Click **"Get started"**
3. Click the **"Sign-in method"** tab
4. Click **"Google"**
5. Toggle **"Enable"**
6. Select a project support email (your email)
7. Click **"Save"**

That's it! Google Sign-In is now enabled.

## Step 6: Create Your .env File

1. In your project root (`web/` directory), create a file named `.env`
2. Copy the values from the Firebase config you saved earlier:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Important notes:**
- Replace all the placeholder values with your actual Firebase config values
- Make sure the database URL includes the trailing slash: `...firebaseio.com/`
- The `.env` file is already in `.gitignore`, so it won't be committed to git

## Step 7: Test Your Setup

1. In your terminal, navigate to the `web` directory:
   ```bash
   cd web
   ```

2. Install dependencies (if you haven't already):
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open the app in your browser (usually `http://localhost:5173`)

5. Try signing in with Google - it should work!

## Troubleshooting

### "Firebase: Error (auth/unauthorized-domain)"

This error occurs when trying to sign in from a domain that isn't authorized for OAuth operations.

**To fix:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Build** → **Authentication**
4. Click the **Settings** tab
5. Scroll down to **Authorized domains**
6. Click **Add domain**
7. Enter your domain (e.g., `www.skunk.games` or `skunk.games`)
8. Click **Done**

**Important:**
- Add both `www.skunk.games` and `skunk.games` if you use both variants
- `localhost` is automatically included for local development
- Changes take effect immediately (no need to redeploy)

### Database URL not found
- Make sure you enabled Realtime Database (not Firestore)
- The URL format should be: `https://[project-id]-default-rtdb.firebaseio.com/`

### Permission denied errors
- Check that your security rules are published
- Verify you're signed in (check Authentication → Users tab)

### Can't find Firebase config
- Go to Project Settings (gear icon) → Your apps
- Click on your web app to see the config again

## Next Steps

Once everything is working:
1. Test creating a game
2. Test adding a player
3. Test the activity feed

You're all set! 🎉

