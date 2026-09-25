import { useNavigate } from "react-router-dom";
import { usePlayerSessions } from "../hooks/usePlayerSessions";
import { useGames } from "../hooks/useGames";
import { ChevronRightIcon } from "../components/icons";
import { NavBar } from "../components/NavBar";
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
      <NavBar title="My Sessions" />

      <div className="page-content">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <p>You're not in any sessions</p>
          </div>
        ) : (
          <div className="sessions-list list">
            {sessions.map(session => (
              <button
                type="button"
                key={session.id}
                className="session-row row-press"
                onClick={() => navigate(`/session/${session.code}`)}
              >
                <div className="session-row-main">
                  <div className="session-code">Session {session.code}</div>
                  <div className="session-meta">
                    {session.gameID && `${getGameTitle(session.gameID) || "Unknown Game"} · `}
                    {session.participantIDs.length} player{session.participantIDs.length !== 1 ? 's' : ''}
                    {` · ${formatDate(session.lastActivityAt)}`}
                  </div>
                </div>
                <ChevronRightIcon className="session-chevron" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

