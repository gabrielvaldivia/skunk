import { useMemo, useState } from 'react';
import { useActivity } from '../hooks/useActivity';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { useFriendIds, type ActivityAudience } from '../hooks/useFriends';
import { MiniSessionSheet } from '../components/MiniSessionSheet';
import { MatchRow } from '../components/MatchRow';
import { AudienceControl } from '../components/AudienceControl';
import './ActivityPage.css';
import { useAppNavigate } from "../components/AppLink";
import { NavBar } from "../components/NavBar";
import { Button } from "@/components/ui/button";
import { PlayersIcon } from "../components/icons";

export function ActivityPage() {
  const navigate = useAppNavigate();
  const { matches, isLoading, error } = useActivity();
  const { currentSession } = useSession();
  const { player } = useAuth();
  const friendIds = useFriendIds();
  const [audience, setAudience] = useState<ActivityAudience>('friends');
  const visibleMatches = useMemo(
    () =>
      !player || audience === 'global'
        ? matches
        : matches.filter((match) => match.playerIDs.some((playerId) => friendIds.has(playerId))),
    [audience, friendIds, matches, player]
  );

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
        {player && <AudienceControl value={audience} onChange={setAudience} />}
        {visibleMatches.length === 0 ? (
          <div className="empty-state">
            <p>{audience === 'friends' && player ? 'No friend activity yet' : 'No matches yet'}</p>
            <p className="empty-hint">
              {audience === 'friends' && player
                ? 'Follow players or share a session to see their matches here.'
                : 'Start a session from any game to record one.'}
            </p>
          </div>
        ) : (
          <div className="matches-list">
            {visibleMatches.map(match => (
              <MatchRow key={match.id} match={match} hideGameTitle={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
