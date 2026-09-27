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
async function importGooglePhoto(photoURL: string): Promise<string> {
  // Google serves any size; ask for one big enough for the profile page
  const url = photoURL.replace(/=s\d+-c$/, "=s256-c");
  const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Google allows it, so the canvas stays readable
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load Google photo"));
    img.src = url;
  });
  const size = Math.min(256, bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  // Centre-crop to a square
  const side = Math.min(bitmap.width, bitmap.height);
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadingPlayerIdRef = useRef<string | null>(null);

  const loadPlayer = useCallback(async (firebaseUser: User) => {
    const googleUserID = firebaseUser.uid;
    
    // Prevent concurrent calls for the same user
    if (loadingPlayerIdRef.current === googleUserID) {
      return;
    }
    
    loadingPlayerIdRef.current = googleUserID;
    
    try {
      let currentPlayer = await getPlayerByGoogleUserID(googleUserID);

      if (!currentPlayer) {
        // Create a new player for this user (similar to iOS app behavior)
        const displayName = firebaseUser.displayName || "Player";
        currentPlayer = await createPlayer({
          name: displayName,
          googleUserID: googleUserID,
          ownerID: googleUserID,
          email: firebaseUser.email || undefined,
          needsOnboarding: true,
        });
      } else if (currentPlayer.googleUserID && !currentPlayer.email && firebaseUser.email) {
        // Update existing player with email if missing
        await updatePlayer(currentPlayer.id, { email: firebaseUser.email });
        currentPlayer = { ...currentPlayer, email: firebaseUser.email };
      }

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
      }
    }
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

  const refreshPlayer = async () => {
    if (user) {
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
