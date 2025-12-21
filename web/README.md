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

### 4. Run Development Server

```bash
npm run dev
```

### 5. Build for Production

```bash
npm run build
```

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
