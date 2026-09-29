import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { type User } from "firebase/auth";
import {
  signInWithGoogle,
  signOut as authSignOut,
  onAuthStateChange,
  getCurrentUser,
} from "../services/authService";
import {
  getPlayerByGoogleUserID,
  createPlayer,
  updatePlayer,
} from "../services/databaseService";
import type { Player } from "../models/Player";
import { squarePhotoBase64 } from "../lib/photo";

interface AuthContextType {
  user: User | null;
  player: Player | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsOnboarding: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshPlayer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A Google profile photo as base64 JPEG (no data: prefix), like uploaded photos
function importGooglePhoto(photoURL: string): Promise<string> {
  // Google serves any size; ask for one big enough for the profile page.
  // Google allows cross-origin reads, so the canvas stays readable.
  return squarePhotoBase64(photoURL.replace(/=s\d+-c$/, "=s256-c"), "anonymous");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadingPlayerIdRef = useRef<string | null>(null);
  // The load in progress, so a refresh can wait for it rather than be skipped
  const loadingPromiseRef = useRef<Promise<void> | null>(null);

  const loadPlayer = useCallback((firebaseUser: User): Promise<void> => {
    const googleUserID = firebaseUser.uid;

    // Prevent concurrent loads for the same user (both could create a player)
    if (loadingPlayerIdRef.current === googleUserID && loadingPromiseRef.current) {
      return loadingPromiseRef.current;
    }

    loadingPlayerIdRef.current = googleUserID;
    const load = (async () => {
      try {
        let currentPlayer = await getPlayerByGoogleUserID(googleUserID);

        if (!currentPlayer) {
          // Create a new player for this user (similar to iOS app behavior)
          const displayName = firebaseUser.displayName || "Player";
          currentPlayer = await createPlayer({
            name: displayName,
            googleUserID: googleUserID,
            ownerID: googleUserID,
            needsOnboarding: true,
          });
        }
        // Emails aren't stored on player records: players are publicly
        // readable. The signed-in user's own email comes from Firebase Auth.

        setPlayer(currentPlayer);

        // No photo of their own yet: use their Google one, so others see it too
        // (the account button showing the Google photo made it look set)
        if (!currentPlayer.photoData && firebaseUser.photoURL) {
          const playerId = currentPlayer.id;
          importGooglePhoto(firebaseUser.photoURL)
            .then(async (photoData) => {
              await updatePlayer(playerId, { photoData });
              setPlayer((p) => (p && p.id === playerId ? { ...p, photoData } : p));
            })
            .catch((err) => console.warn("Couldn't copy Google photo:", err));
        }
      } catch (error) {
        console.error("Error loading player:", error);
      } finally {
        if (loadingPlayerIdRef.current === googleUserID) {
          loadingPlayerIdRef.current = null;
          loadingPromiseRef.current = null;
        }
      }
    })();
    loadingPromiseRef.current = load;
    return load;
  }, []);

  useEffect(() => {
    // Check for existing auth state
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      loadPlayer(currentUser);
    } else {
      setIsLoading(false);
    }

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await loadPlayer(firebaseUser);
      } else {
        setUser(null);
        setPlayer(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, [loadPlayer]);

  const signIn = async () => {
    try {
      const firebaseUser = await signInWithGoogle();
      setUser(firebaseUser);
      await loadPlayer(firebaseUser);
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await authSignOut();
      setUser(null);
      setPlayer(null);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  // After a change (heart, follow…): wait out any load already running, which
  // may have read before the change, then read again
  const refreshPlayer = async () => {
    if (user) {
      if (loadingPromiseRef.current) await loadingPromiseRef.current;
      await loadPlayer(user);
    }
  };

  const needsOnboarding = !!(
    player &&
    (!player.name || player.needsOnboarding)
  );

  const value: AuthContextType = {
    user,
    player,
    isAuthenticated: !!user,
    isLoading,
    needsOnboarding,
    signIn,
    signOut,
    refreshPlayer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
