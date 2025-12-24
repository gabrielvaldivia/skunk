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
  getAuthRedirectResult,
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
        });
      } else if (currentPlayer.googleUserID && !currentPlayer.email && firebaseUser.email) {
        // Update existing player with email if missing
        await updatePlayer(currentPlayer.id, { email: firebaseUser.email });
        currentPlayer = { ...currentPlayer, email: firebaseUser.email };
      }

      setPlayer(currentPlayer);
    } catch (error) {
      console.error("Error loading player:", error);
    } finally {
      if (loadingPlayerIdRef.current === googleUserID) {
        loadingPlayerIdRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        // First, check if we're returning from a redirect
        const redirectUser = await getAuthRedirectResult();
        if (redirectUser && mounted) {
          setUser(redirectUser);
          await loadPlayer(redirectUser);
          setIsLoading(false);
          return;
        }

        // Check for existing auth state
        const currentUser = getCurrentUser();
        if (currentUser && mounted) {
          setUser(currentUser);
          await loadPlayer(currentUser);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (!mounted) return;
      
      if (firebaseUser) {
        setUser(firebaseUser);
        await loadPlayer(firebaseUser);
      } else {
        setUser(null);
        setPlayer(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [loadPlayer]);

  const signIn = async () => {
    try {
      // signInWithRedirect will navigate away, so we don't need to handle the result here
      // The redirect result will be handled in the useEffect when the user returns
      await signInWithGoogle();
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
    !player.name
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
