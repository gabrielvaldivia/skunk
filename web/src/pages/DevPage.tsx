import { useState } from "react";
import { usePlayers } from "../hooks/usePlayers";
import { useAuth } from "../context/AuthContext";
import { PlayerCard } from "../components/PlayerCard";
import { Button } from "@/components/ui/button";
import type { Player } from "../models/Player";
import "./DevPage.css";

export function DevPage() {
  const { players, isLoading, error, fetchPlayers, removePlayer } = usePlayers();
  const { player: currentPlayer } = useAuth();
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="loading">Loading players...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  const handleDeletePlayer = async (playerId: string) => {
    const playerToDelete = players.find((p) => p.id === playerId);
    if (!playerToDelete) return;

    // In dev mode, allow deleting any profile, but warn if it's the current user's profile
    if (currentPlayer && playerId === currentPlayer.id) {
      if (!window.confirm("Warning: You are about to delete your own profile. This may cause issues. Are you sure?")) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to delete "${playerToDelete.name}"?`)) {
        return;
      }
    }

    setDeletingPlayerId(playerId);
    try {
      await removePlayer(playerId);
      await fetchPlayers();
    } catch (err) {
      console.error("Error deleting profile:", err);
      alert("Failed to delete profile");
    } finally {
      setDeletingPlayerId(null);
    }
  };

  return (
    <div className="dev-page">
      <div className="page-header">
        <h1>Dev Tools - All Profiles</h1>
      </div>

      <div className="dev-info">
        <p>Total profiles: {players.filter(p => p.googleUserID).length}</p>
        <p>Total players (including invalid): {players.length}</p>
      </div>

      {players.length === 0 ? (
        <div className="empty-state">
          <p>No profiles yet</p>
        </div>
      ) : (
        <div className="players-list">
          {players.map((player) => {
            return (
              <div 
                key={player.id} 
                className="player-item"
              >
                <PlayerCard player={player} />
                <div className="player-details">
                  <p><strong>ID:</strong> {player.id}</p>
                  <p><strong>Google User ID:</strong> {player.googleUserID || "N/A"}</p>
                </div>
                <div className="player-actions">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeletePlayer(player.id)}
                    disabled={deletingPlayerId === player.id}
                  >
                    {deletingPlayerId === player.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

