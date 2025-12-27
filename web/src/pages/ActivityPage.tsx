import { useNavigate } from "react-router-dom";
import { useActivity } from '../hooks/useActivity';
import { useSession } from '../context/SessionContext';
import { MiniSessionSheet } from '../components/MiniSessionSheet';
import { MatchRow } from '../components/MatchRow';
import './ActivityPage.css';

export function ActivityPage() {
  const navigate = useNavigate();
  const { matches, isLoading, error } = useActivity();
  const { currentSession } = useSession();

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
      </div>
      {currentSession && <MiniSessionSheet />}

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

