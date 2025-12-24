import { useActivity } from '../hooks/useActivity';
import { MatchRow } from '../components/MatchRow';
import './ActivityPage.css';

export function ActivityPage() {
  const { matches, isLoading, error } = useActivity();

  if (isLoading) {
    return <div className="loading">Loading activity...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="activity-page">
      <div className="page-header">
        <h1>Activity</h1>
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

