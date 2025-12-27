import { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayers } from "../hooks/usePlayers";
import { useAuth } from "../context/AuthContext";
import { useSession } from "../context/SessionContext";
import { MiniSessionSheet } from "../components/MiniSessionSheet";
import { PlayerCard } from "../components/PlayerCard";
import { useMediaQuery } from "../hooks/use-media-query";
import { useActivity } from "../hooks/useActivity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { Player } from "../models/Player";
import "./PlayersPage.css";

const ADMIN_EMAIL = "valdivia.gabriel@gmail.com";

interface PlayerItemProps {
  player: Player;
  canDelete: boolean;
  onNavigate: (playerId: string) => void;
  onLongPress: (playerId: string, ownerID?: string) => void;
  subtitle?: string;
}

function PlayerItem({ player, canDelete, onNavigate, onLongPress, subtitle }: PlayerItemProps) {
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressRef = useRef(false);

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canDelete) return;
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress(player.id, player.ownerID);
      // Prevent default touch behaviors when long press triggers
      if ('touches' in e) {
        e.preventDefault();
      }
    }, 500);
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canDelete) return;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onNavigate(player.id);
  };

  return (
    <div 
      className={`player-item ${canDelete ? 'player-item-deletable' : ''}`}
      onMouseDown={canDelete ? handlePressStart : undefined}
      onMouseUp={canDelete ? handlePressEnd : undefined}
      onMouseLeave={canDelete ? handlePressEnd : undefined}
      onTouchStart={canDelete ? handlePressStart : undefined}
      onTouchEnd={canDelete ? handlePressEnd : undefined}
      onClick={canDelete ? handleClick : () => onNavigate(player.id)}
    >
      <PlayerCard player={player} subtitle={subtitle} />
    </div>
  );
}

export function PlayersPage() {
  const navigate = useNavigate();
  const { players, isLoading, error, addPlayer, removePlayer } = usePlayers();
  const { user, player: currentUserPlayer, isAuthenticated } = useAuth();
  const { currentSession } = useSession();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<{ id: string; ownerID?: string } | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { matches } = useActivity(10000);

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Previous grouping removed; we sort everyone by last played

  // Map latest match date for each player
  const lastPlayedMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const match of matches) {
      for (const pid of match.playerIDs) {
        const current = map.get(pid) || 0;
        if (match.date > current) {
          map.set(pid, match.date);
        }
      }
    }
    return map;
  }, [matches]);

  const formatRelative = (timestamp?: number) => {
    if (!timestamp) return "No matches yet";
    const now = Date.now();
    const diffMs = now - timestamp;
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  // Sort players by most recent match date (desc). Ties fall back to name.
  const sortedPlayers = useMemo(() => {
    const arr = [...players];
    arr.sort((a, b) => {
      const tb = lastPlayedMap.get(b.id) || 0;
      const ta = lastPlayedMap.get(a.id) || 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [players, lastPlayedMap]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !user || !isAdmin) return;

    setIsSubmitting(true);
    try {
      const newPlayer: Omit<Player, "id"> = {
        name: newPlayerName.trim(),
        ownerID: user.uid,
      };
      await addPlayer(newPlayer);
      setNewPlayerName("");
      setShowAddForm(false);
    } catch (err) {
      console.error("Error adding player:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlayer = async () => {
    if (!playerToDelete || !user) return;
    
    const { id: playerId, ownerID } = playerToDelete;
    
    // Admins can delete any player
    if (!isAdmin) {
      // Permission check: only allow deletion if user owns the player and it's not their own profile
      if (ownerID !== user.uid) {
        alert("You can only delete players that you created.");
        setShowDeleteDialog(null);
        setPlayerToDelete(null);
        return;
      }

      const playerToDeleteCheck = players.find((p) => p.id === playerId);
      if (playerToDeleteCheck?.googleUserID === user.uid) {
        alert("To remove your profile, you need to delete your account.");
        setShowDeleteDialog(null);
        setPlayerToDelete(null);
        return;
      }
    }

    setShowDeleteDialog(null);
    try {
      await removePlayer(playerId);
    } catch (err) {
      console.error("Error deleting player:", err);
      alert("Failed to delete player");
    } finally {
      setPlayerToDelete(null);
    }
  };

  const handleLongPress = (playerId: string, ownerID?: string) => {
    setPlayerToDelete({ id: playerId, ownerID });
    setShowDeleteDialog(playerId);
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
        {isAdmin && (
          <Button onClick={() => setShowAddForm(true)}>+ Add Player</Button>
        )}
      </div>

      {currentSession && <MiniSessionSheet />}

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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-content">
        {players.length === 0 ? (
          <div className="empty-state">
            <p>No players yet</p>
            {isAdmin ? (
              <p className="empty-hint">Click "Add Player" to create a player</p>
            ) : (
              <p className="empty-hint">Only administrators can add players</p>
            )}
          </div>
        ) : (
          <div className="players-list">
            {sortedPlayers.map((player) => {
              const canDelete =
                isAuthenticated &&
                (isAdmin ||
                  (player.ownerID === user?.uid && player.googleUserID !== user?.uid));
              const lastPlayed = lastPlayedMap.get(player.id);
              const subtitle = lastPlayed && lastPlayed > 0
                ? `Last played ${formatRelative(lastPlayed)}`
                : 'No matches yet';
              
              return (
                <PlayerItem
                  key={player.id}
                  player={player}
                  canDelete={canDelete}
                  onNavigate={(playerId) => navigate(`/players/${playerId}`)}
                  onLongPress={handleLongPress}
                  subtitle={subtitle}
                />
              );
            })}
          </div>
        )}
      </div>

      {isDesktop ? (
        <Dialog 
          open={showDeleteDialog !== null} 
          onOpenChange={(open) => {
            if (!open) {
              setShowDeleteDialog(null);
              setPlayerToDelete(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete Player</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this player? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(null);
                  setPlayerToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeletePlayer}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer 
          open={showDeleteDialog !== null} 
          onOpenChange={(open) => {
            if (!open) {
              setShowDeleteDialog(null);
              setPlayerToDelete(null);
            }
          }}
        >
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Delete Player</DrawerTitle>
              <DrawerDescription>
                Are you sure you want to delete this player? This action cannot be undone.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <DrawerFooter className="px-0">
                <Button
                  variant="destructive"
                  onClick={handleDeletePlayer}
                  className="w-full"
                >
                  Delete
                </Button>
                <DrawerClose asChild>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowDeleteDialog(null);
                      setPlayerToDelete(null);
                    }}
                  >
                    Cancel
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
