import { useNavigate } from "react-router-dom";
import { usePlayerSessions } from "../hooks/usePlayerSessions";
import { useGames } from "../hooks/useGames";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import "./SessionsListPage.css";

export function SessionsListPage() {
  const navigate = useNavigate();
  const { sessions, isLoading, error } = usePlayerSessions();
  const { games } = useGames();

  const getGameTitle = (gameID?: string) => {
    if (!gameID) return null;
    const game = games.find(g => g.id === gameID);
    return game?.title;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="sessions-list-page">
        <div className="loading">Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sessions-list-page">
        <div className="error">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="sessions-list-page">
      <div className="page-header">
        <div className="page-header-top">
          <Button variant="outline" onClick={() => navigate(-1)} size="icon">
            <ChevronLeft />
          </Button>
        </div>
        <h1>My Sessions</h1>
      </div>

      <div className="page-content">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <p>You're not in any sessions</p>
          </div>
        ) : (
          <div className="sessions-list">
            {sessions.map(session => (
              <div
                key={session.id}
                className="session-card"
                onClick={() => navigate(`/session/${session.code}`)}
              >
                <div className="session-card-header">
                  <h2 className="session-code">Session {session.code}</h2>
                  <span className="session-time">{formatDate(session.lastActivityAt)}</span>
                </div>
                {session.gameID && (
                  <div className="session-game">
                    {getGameTitle(session.gameID) || "Unknown Game"}
                  </div>
                )}
                <div className="session-participants">
                  {session.participantIDs.length} participant{session.participantIDs.length !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

