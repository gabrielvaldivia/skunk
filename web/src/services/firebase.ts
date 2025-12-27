import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Firebase configuration
// Validate env values and construct a safe databaseURL to avoid runtime parse errors
const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const envDatabaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined;
const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const envStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const envMessagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;

function normalizeDatabaseUrl(url: string | undefined, projectId: string | undefined): string | undefined {
  // If provided and looks like an https URL, ensure trailing slash
  if (url && /^https?:\/\//i.test(url)) {
    return url.endsWith('/') ? url : `${url}/`;
  }
  // If not provided, try to derive from projectId
  if (!url && projectId && projectId !== 'your-project-id') {
    return `https://${projectId}-default-rtdb.firebaseio.com/`;
  }
  // Otherwise leave undefined so Firebase can surface a clearer error
  return undefined;
}

const firebaseConfig = {
  apiKey: envApiKey,
  authDomain: envAuthDomain,
  databaseURL: normalizeDatabaseUrl(envDatabaseURL, envProjectId),
  projectId: envProjectId,
  storageBucket: envStorageBucket,
  messagingSenderId: envMessagingSenderId,
  appId: envAppId
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Initialize Realtime Database
export const database = getDatabase(app);

export default app;

