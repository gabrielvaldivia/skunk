import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayers } from "../hooks/usePlayers";
import { useAuth } from "../context/AuthContext";
import { PlayerCard } from "../components/PlayerCard";
import { useMediaQuery } from "../hooks/use-media-query";
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
}

function PlayerItem({ player, canDelete, onNavigate, onLongPress }: PlayerItemProps) {
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
      <PlayerCard player={player} />
    </div>
  );
}

export function PlayersPage() {
  const navigate = useNavigate();
  const { players, isLoading, error, addPlayer, removePlayer } = usePlayers();
  const { user, player: currentUserPlayer, isAuthenticated } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<{ id: string; ownerID?: string } | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Organize players similar to Swift implementation, but ensure all players are shown
  const currentUser = currentUserPlayer;
  
  // Get all player IDs we've already included
  const includedPlayerIds = new Set<string>();
  if (currentUser) {
    includedPlayerIds.add(currentUser.id);
  }
  
  // Managed players: owned by current user but no googleUserID (not the current user's profile)
  const managedPlayers = players.filter(
    (p) => p.ownerID === user?.uid && !p.googleUserID && !includedPlayerIds.has(p.id)
  );
  managedPlayers.forEach(p => includedPlayerIds.add(p.id));
  
  // Other users: have googleUserID but not the current user's, and not owned by current user
  const otherUsers = players.filter(
    (p) =>
      p.googleUserID && 
      p.googleUserID !== user?.uid && 
      p.ownerID !== user?.uid &&
      !includedPlayerIds.has(p.id)
  );
  otherUsers.forEach(p => includedPlayerIds.add(p.id));
  
  // All remaining players that weren't included in the above categories
  const remainingPlayers = players.filter(
    (p) => !includedPlayerIds.has(p.id)
  );

  const allPlayers = [
    ...(currentUser ? [currentUser] : []),
    ...managedPlayers.sort((a, b) => a.name.localeCompare(b.name)),
    ...otherUsers.sort((a, b) => a.name.localeCompare(b.name)),
    ...remainingPlayers.sort((a, b) => a.name.localeCompare(b.name)),
  ];

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

      {allPlayers.length === 0 ? (
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
          {allPlayers.map((player) => {
            const canDelete =
              isAuthenticated &&
              (isAdmin ||
                (player.ownerID === user?.uid && player.googleUserID !== user?.uid));
            
            return (
              <PlayerItem
                key={player.id}
                player={player}
                canDelete={canDelete}
                onNavigate={(playerId) => navigate(`/players/${playerId}`)}
                onLongPress={handleLongPress}
              />
            );
          })}
        </div>
      )}

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
