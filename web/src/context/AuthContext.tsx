import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { signInWithGoogle, signOut as authSignOut, onAuthStateChange, getCurrentUser } from '../services/authService';
import { getPlayerByGoogleUserID, createPlayer } from '../services/databaseService';
import type { Player } from '../models/Player';

interface AuthContextType {
  user: User | null;
  player: Player | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlayer = useCallback(async (firebaseUser: User) => {
    try {
      const googleUserID = firebaseUser.uid;
      let currentPlayer = await getPlayerByGoogleUserID(googleUserID);
      
      if (!currentPlayer) {
        // Create a new player for this user (similar to iOS app behavior)
        const displayName = firebaseUser.displayName || 'Player';
        currentPlayer = await createPlayer({
          name: displayName,
          googleUserID: googleUserID,
          ownerID: googleUserID
        });
      }
      
      setPlayer(currentPlayer);
    } catch (error) {
      console.error('Error loading player:', error);
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
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await authSignOut();
      setUser(null);
      setPlayer(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    player,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

