import { useNavigate } from "react-router-dom";
import { useActivity } from '../hooks/useActivity';
import { usePlayerSessions } from '../hooks/usePlayerSessions';
import { MatchRow } from '../components/MatchRow';
import { ChevronRight } from "lucide-react";
import './ActivityPage.css';

export function ActivityPage() {
  const navigate = useNavigate();
  const { matches, isLoading, error } = useActivity();
  const { sessions, isLoading: sessionsLoading } = usePlayerSessions();

  if (isLoading) {
    return <div className="loading">Loading activity...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  const activeSessions = sessions.filter(s => s); // Filter out any null/undefined

  return (
    <div className="activity-page">
      <div className="page-header">
        <h1>Activity</h1>
        {!sessionsLoading && activeSessions.length > 0 && (
          <div className="session-banner">
            {activeSessions.length === 1 ? (
              <button
                className="session-banner-link"
                onClick={() => navigate(`/session/${activeSessions[0].code}`)}
              >
                <span className="session-banner-text">
                  You're in Session {activeSessions[0].code}
                </span>
                <ChevronRight className="session-banner-arrow" size={20} />
              </button>
            ) : (
              <button
                className="session-banner-link"
                onClick={() => navigate('/sessions')}
              >
                <span className="session-banner-text">
                  You're in {activeSessions.length} sessions
                </span>
                <ChevronRight className="session-banner-arrow" size={20} />
              </button>
            )}
          </div>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="empty-state">
          <p>No matches yet</p>
        </div>
      ) : (
        <div className="matches-list">
          {matches.map(match => (
            <MatchRow key={match.id} match={match} hideGameTitle={false} />
          ))}
        </div>
      )}
    </div>
  );
}

