import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import {
  createSession,
  getSessionByCode,
  joinSession as dbJoinSession,
  leaveSession as dbLeaveSession,
  getSession,
} from "../services/databaseService";
import type { Session } from "../models/Session";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "skunk_current_session";

interface SessionContextType {
  currentSession: Session | null;
  isLoading: boolean;
  createSession: (gameID?: string) => Promise<Session>;
  joinSession: (code: string) => Promise<void>;
  leaveSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user, player } = useAuth();
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSessionFromStorage = async () => {
      try {
        const storedSessionId = localStorage.getItem(STORAGE_KEY);
        if (storedSessionId) {
          const session = await getSession(storedSessionId);
          if (session) {
            setCurrentSession(session);
          } else {
            // Session doesn't exist, clear storage
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error("Error loading session from storage:", error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessionFromStorage();
  }, []);

  const handleCreateSession = useCallback(async (gameID?: string): Promise<Session> => {
    if (!user || !player) {
      throw new Error("User must be authenticated to create a session");
    }

    const session = await createSession(user.uid, gameID);
    // Add creator as participant
    await dbJoinSession(session.id, player.id);
    // Refresh to get updated session with participant
    const updatedSession = await getSession(session.id);
    if (updatedSession) {
      setCurrentSession(updatedSession);
      localStorage.setItem(STORAGE_KEY, updatedSession.id);
      return updatedSession;
    }
    return session;
  }, [user, player]);

  const handleJoinSession = useCallback(
    async (code: string): Promise<void> => {
      if (!player) {
        throw new Error("Player must be loaded to join a session");
      }

      // Leave current session if in one
      if (currentSession) {
        try {
          await dbLeaveSession(currentSession.id, player.id);
        } catch (err) {
          // Ignore errors when leaving (session might not exist anymore)
          console.warn("Error leaving previous session:", err);
        }
      }

      const session = await getSessionByCode(code);
      if (!session) {
        throw new Error("Session not found or has expired");
      }

      // Join the session
      await dbJoinSession(session.id, player.id);
      
      // Refresh session to get updated participants
      const updatedSession = await getSession(session.id);
      if (updatedSession) {
        setCurrentSession(updatedSession);
        localStorage.setItem(STORAGE_KEY, updatedSession.id);
      }
    },
    [player, currentSession]
  );

  const handleLeaveSession = useCallback(async (): Promise<void> => {
    if (!currentSession || !player) {
      return;
    }

    try {
      await dbLeaveSession(currentSession.id, player.id);
      setCurrentSession(null);
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Error leaving session:", error);
      // Clear state even if there's an error
      setCurrentSession(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentSession, player]);

  const handleRefreshSession = useCallback(async (): Promise<void> => {
    if (!currentSession) {
      return;
    }

    try {
      const session = await getSession(currentSession.id);
      if (session) {
        setCurrentSession(session);
      } else {
        // Session doesn't exist anymore
        setCurrentSession(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error refreshing session:", error);
    }
  }, [currentSession]);

  const value: SessionContextType = {
    currentSession,
    isLoading,
    createSession: handleCreateSession,
    joinSession: handleJoinSession,
    leaveSession: handleLeaveSession,
    refreshSession: handleRefreshSession,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

