# Step-by-Step Firebase Setup

## Step 1: Register Web App ✅ (You're here!)

1. Click the **Web icon** (`</>`) on the Project Overview page
2. Enter an app nickname: `skunk-web` (or any name you like)
3. (Optional) Uncheck "Also set up Firebase Hosting" if you don't need it yet
4. Click **"Register app"**
5. You'll see a config object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "skunk-xxxxx.firebaseapp.com",
  databaseURL: "https://skunk-xxxxx-default-rtdb.firebaseio.com",
  projectId: "skunk",
  storageBucket: "skunk.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
```

6. **Copy all these values** - you'll paste them to me next!

## Step 2: Enable Realtime Database

1. In the left sidebar, click **"Build"** to expand it
2. Click **"Realtime Database"**
3. Click **"Create database"**
4. Choose a location (select closest to your users)
5. Click **"Next"**
6. Choose **"Start in test mode"** (we'll add proper rules after)
7. Click **"Enable"**
8. Note the database URL at the top (should match the databaseURL in your config)

## Step 3: Set Security Rules

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
        ".write": "!data.exists() || data.child('googleUserID').val() == auth.uid"
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

## Step 4: Enable Google Sign-In

1. In the left sidebar, under "Build", click **"Authentication"**
2. Click **"Get started"** (if this is the first time)
3. Click the **"Sign-in method"** tab
4. Click **"Google"**
5. Toggle **"Enable"** to ON
6. Select a project support email (your email)
7. Click **"Save"**

## Step 5: Share Config Values

Once you have all the config values, paste them here and I'll create your `.env` file!
