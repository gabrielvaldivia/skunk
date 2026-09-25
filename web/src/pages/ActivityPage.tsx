import { useActivity } from '../hooks/useActivity';
import { useSession } from '../context/SessionContext';
import { MiniSessionSheet } from '../components/MiniSessionSheet';
import { MatchRow } from '../components/MatchRow';
import './ActivityPage.css';
import { useAppNavigate } from "../components/AppLink";
import { NavBar } from "../components/NavBar";
import { Button } from "@/components/ui/button";
import { PlayersIcon } from "../components/icons";

export function ActivityPage() {
  const navigate = useAppNavigate();
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
      <NavBar
        title="Activity"
        action={
          <Button variant="secondary" size="icon" onClick={() => navigate("/players")} aria-label="Players">
            <PlayersIcon className="!size-5" />
          </Button>
        }
      />
      {currentSession && <MiniSessionSheet />}

      <div className="page-content">
        {matches.length === 0 ? (
          <div className="empty-state">
            <p>No matches yet</p>
            <p className="empty-hint">Start a session from any game to record one.</p>
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

