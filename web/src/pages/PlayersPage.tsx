import { usePlayers } from "../hooks/usePlayers";
import { useAuth } from "../context/AuthContext";
import { PlayerCard } from "../components/PlayerCard";
import "./PlayersPage.css";

export function PlayersPage() {
  const { players, isLoading, error } = usePlayers();
  const { player: currentUserPlayer } = useAuth();

  // Only show profiles (players with googleUserID)
  const profiles = players.filter((p) => p.googleUserID);
  
  // Sort: current user first, then others alphabetically
  const sortedProfiles = [...profiles].sort((a, b) => {
    if (currentUserPlayer && a.id === currentUserPlayer.id) return -1;
    if (currentUserPlayer && b.id === currentUserPlayer.id) return 1;
    return a.name.localeCompare(b.name);
  });

  if (isLoading) {
    return <div className="loading">Loading players...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="players-page">
      <div className="page-header">
        <h1>Profiles</h1>
      </div>

      {sortedProfiles.length === 0 ? (
        <div className="empty-state">
          <p>No profiles yet</p>
          <p className="empty-hint">Sign in to create your profile</p>
        </div>
      ) : (
        <div className="players-list">
          {sortedProfiles.map((player) => (
            <div key={player.id} className="player-item">
              <PlayerCard player={player} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
