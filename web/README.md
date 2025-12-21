# Skunk Web App

Web version of the Skunk game tracking app built with React, TypeScript, and Firebase.

## Features

- **Games**: Create and manage games
- **Players**: Manage players and profiles
- **Activity**: View recent match history

## Tech Stack

- React + TypeScript
- Firebase Realtime Database
- Firebase Authentication (Google Sign-In)
- React Router
- Vite

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Configuration

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firebase Realtime Database
3. Enable Firebase Authentication and configure Google Sign-In
4. Copy your Firebase configuration
5. Create a `.env` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_DATABASE_URL=your-database-url
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 3. Firebase Security Rules

Set up your Firebase Realtime Database security rules:

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

### 4. Run Development Server

```bash
npm run dev
```

### 5. Build for Production

```bash
npm run build
```

## Deployment to Vercel

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI globally:
```bash
npm i -g vercel
```

2. Navigate to the `web` directory:
```bash
cd web
```

3. Run the deployment command:
```bash
vercel
```

4. Follow the prompts to:
   - Link to an existing project or create a new one
   - Set the root directory (should be `web` or `.` if already in web directory)
   - Confirm build settings (should auto-detect from `vercel.json`)

5. Add environment variables in Vercel dashboard:
   - Go to your project settings → Environment Variables
   - Add all Firebase environment variables:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_DATABASE_URL`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`

6. Redeploy after adding environment variables:
```bash
vercel --prod
```

### Option 2: Deploy via GitHub Integration

1. Push your code to GitHub (if not already done)

2. Go to [Vercel Dashboard](https://vercel.com/dashboard)

3. Click "Add New Project"

4. Import your GitHub repository

5. Configure the project:
   - **Root Directory**: Set to `web`
   - **Framework Preset**: Vite (should auto-detect)
   - **Build Command**: `npm run build` (should auto-detect)
   - **Output Directory**: `dist` (should auto-detect)
   - **Install Command**: `npm install` (should auto-detect)

6. Add environment variables:
   - Add all Firebase environment variables listed above
   - Make sure to add them for Production, Preview, and Development environments

7. Click "Deploy"

### Important Notes

- The `vercel.json` file is already configured for SPA routing (all routes redirect to `index.html`)
- Environment variables must be set in Vercel dashboard for the app to work
- After deployment, update your Firebase Authentication authorized domains to include your Vercel domain
- The app will automatically redeploy on every push to your main branch (if using GitHub integration)

## Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Main views (Games, Players, Activity)
├── services/           # Firebase and auth services
├── models/             # TypeScript interfaces
├── hooks/              # Custom React hooks
├── context/            # React Context providers
└── App.tsx             # Main app component
```

## Based on iOS App

This web version is based on the Swift/SwiftUI iOS app, preserving:
- Data models (Game, Player, Match)
- Business logic (winner calculation, scoring rules)
- View structure and navigation
- Permission checks and data access patterns

## License

Same as the main Skunk project.
