import { useState } from 'react';
import { usePlayers } from '../hooks/usePlayers';
import { useAuth } from '../context/AuthContext';
import { PlayerCard } from '../components/PlayerCard';
import { Button } from '@/components/ui/button';
import type { Player } from '../models/Player';
import './PlayersPage.css';

export function PlayersPage() {
  const { players, isLoading, error, addPlayer, removePlayer } = usePlayers();
  const { user, player: currentUserPlayer, isAuthenticated } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Organize players similar to Swift implementation
  const currentUser = currentUserPlayer;
  const managedPlayers = players.filter(
    p => p.ownerID === user?.uid && p.googleUserID !== user?.uid
  );
  const otherUsers = players.filter(
    p => p.googleUserID && p.googleUserID !== user?.uid && p.ownerID !== user?.uid
  );

  const allPlayers = [
    ...(currentUser ? [currentUser] : []),
    ...managedPlayers.sort((a, b) => a.name.localeCompare(b.name)),
    ...otherUsers.sort((a, b) => a.name.localeCompare(b.name))
  ];

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const newPlayer: Omit<Player, 'id'> = {
        name: newPlayerName.trim(),
        ownerID: user.uid
      };
      await addPlayer(newPlayer);
      setNewPlayerName('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Error adding player:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlayer = async (playerId: string, ownerID?: string) => {
    if (!user) return;
    // Permission check: only allow deletion if user owns the player and it's not their own profile
    if (ownerID !== user.uid) {
      alert('You can only delete players that you created.');
      return;
    }

    const playerToDelete = players.find(p => p.id === playerId);
    if (playerToDelete?.googleUserID === user.uid) {
      alert('To remove your profile, you need to delete your account.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this player?')) {
      try {
        await removePlayer(playerId);
      } catch (err) {
        console.error('Error deleting player:', err);
        alert('Failed to delete player');
      }
    }
  };

  if (isLoading) {
    return <div className="loading">Loading players...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="players-page">
      <div className="page-header">
        <h1>Players</h1>
        {isAuthenticated && (
          <Button onClick={() => setShowAddForm(true)}>
            + Add Player
          </Button>
        )}
      </div>

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add New Player</h2>
            <form onSubmit={handleAddPlayer}>
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Player name"
                autoFocus
                required
              />
              <div className="form-actions">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {allPlayers.length === 0 ? (
        <div className="empty-state">
          <p>No players yet</p>
          {isAuthenticated ? (
            <p className="empty-hint">Click "Add Player" to create a player</p>
          ) : (
            <p className="empty-hint">Sign in to create players</p>
          )}
        </div>
      ) : (
        <div className="players-list">
          {allPlayers.map(player => (
            <div key={player.id} className="player-item">
              <PlayerCard player={player} />
              {isAuthenticated && player.ownerID === user?.uid && player.googleUserID !== user?.uid && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeletePlayer(player.id, player.ownerID)}
                >
                  Delete
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

