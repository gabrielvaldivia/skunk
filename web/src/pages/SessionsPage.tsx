import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { usePlayers } from "../hooks/usePlayers";
import { getActiveSessions } from "../services/databaseService";
import { Button } from "@/components/ui/button";
import type { Session } from "../models/Session";
import type { Player } from "../models/Player";
import "./SessionsPage.css";

export function SessionsPage() {
  const navigate = useNavigate();
  const { currentSession, createSession } = useSession();
  const { players } = usePlayers();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const activeSessions = await getActiveSessions();
      setSessions(activeSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    // Refresh sessions every 10 seconds
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateSession = async () => {
    setIsCreatingSession(true);
    try {
      const session = await createSession();
      navigate(`/session/${session.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleJoinSession = (code: string) => {
    navigate(`/session/${code}`);
  };

  const getParticipantNames = (session: Session): string[] => {
    if (!session.participantIDs || session.participantIDs.length === 0 || !players) {
      return [];
    }
    return session.participantIDs
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => p !== undefined)
      .map(p => p.name);
  };

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return <div className="sessions-page"><div className="loading">Loading sessions...</div></div>;
  }

  if (error && sessions.length === 0) {
    return (
      <div className="sessions-page">
        <div className="error">{error}</div>
        <Button onClick={fetchSessions} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="sessions-page">
      <div className="page-header">
        <h1>Sessions</h1>
        <Button
          onClick={handleCreateSession}
          disabled={isCreatingSession}
        >
          {isCreatingSession ? "Creating..." : "+ New Session"}
        </Button>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {sessions.length === 0 ? (
        <div className="empty-state">
          <p>No active sessions</p>
          <p className="empty-hint">Create a session to get started</p>
        </div>
      ) : (
        <div className="sessions-list">
          {sessions.map((session) => {
            const participantNames = getParticipantNames(session);
            const isCurrentSession = currentSession?.id === session.id;

            return (
              <div
                key={session.id}
                className={`session-card ${isCurrentSession ? "current-session" : ""}`}
                onClick={() => handleJoinSession(session.code)}
              >
                <div className="session-header">
                  <div className="session-code">
                    <span className="code-label">Session</span>
                    <span className="code-value">{session.code}</span>
                  </div>
                  {isCurrentSession && (
                    <span className="current-badge">Current</span>
                  )}
                </div>
                <div className="session-info">
                  <div className="participants-info">
                    <span className="participant-count">
                      {participantNames.length} participant{participantNames.length !== 1 ? "s" : ""}
                    </span>
                    {participantNames.length > 0 && (
                      <span className="participant-names">
                        {participantNames.slice(0, 3).join(", ")}
                        {participantNames.length > 3 && ` +${participantNames.length - 3} more`}
                      </span>
                    )}
                  </div>
                  <div className="session-time">
                    Last active {formatTimeAgo(session.lastActivityAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

