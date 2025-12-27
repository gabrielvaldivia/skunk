import { useNavigate } from "react-router-dom";
import { useActivity } from '../hooks/useActivity';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { MiniSessionSheet } from '../components/MiniSessionSheet';
import { MatchRow } from '../components/MatchRow';
import './ActivityPage.css';

export function ActivityPage() {
  const navigate = useNavigate();
  const { matches, isLoading, error } = useActivity();
  const { currentSession } = useSession();
  const { isAuthenticated, player } = useAuth();

  const getInitials = (name: string): string =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  if (isLoading) {
    return <div className="loading">Loading activity...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  // currentSession comes from SessionContext and represents the user's active session (if any)

  return (
    <div className="activity-page">
      <div className="page-header">
        <h1>Activity</h1>
        {isAuthenticated && player && (
          <button
            className="profile-avatar-btn"
            onClick={() => navigate('/profile')}
            aria-label="Account"
          >
            {player.photoData ? (
              <img
                className="profile-avatar"
                src={`data:image/jpeg;base64,${player.photoData}`}
                alt={player.name}
              />
            ) : (
              <span className="profile-avatar initials">
                {getInitials(player.name)}
              </span>
            )}
          </button>
        )}
      </div>
      {currentSession && <MiniSessionSheet />}

      <div className="page-content">
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
    </div>
  );
}

