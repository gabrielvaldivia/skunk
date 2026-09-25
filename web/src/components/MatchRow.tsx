import { useState, useRef } from 'react';
import { AppLink } from './AppLink';
import type { Match } from '../models/Match';
import { usePlayers } from '../hooks/usePlayers';
import { useGames } from '../hooks/useGames';
import { useAuth } from '../context/AuthContext';
import { useMatches } from '../hooks/useMatches';
import { useMediaQuery } from '../hooks/use-media-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import './MatchRow.css';
import { Avatar } from "./Avatar";
import { isAdminEmail } from "@/lib/admin";

interface MatchRowProps {
  match: Match;
  hideGameTitle?: boolean;
  onDelete?: () => void;
}

export function MatchRow({ match, hideGameTitle = false, onDelete }: MatchRowProps) {
  const { players } = usePlayers();
  const { games } = useGames();
  const { user, player: currentPlayer } = useAuth();
  const { removeMatch } = useMatches();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressRef = useRef(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const getGame = () => {
    if (match.game) return match.game;
    return games.find(g => g.id === match.gameID);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp;
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (diffMs >= 0 && diffMs < 60 * 60 * 1000) {
      const mins = Math.max(1, Math.floor(diffMs / 60000));
      return `${mins}m ago`;
    }
    if (timestamp >= startOfToday) return `Today · ${time}`;
    if (timestamp >= startOfToday - 86400000) return `Yesterday · ${time}`;
    const datePart = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    });
    return `${datePart} · ${time}`;
  };

  const getPlayer = (playerID: string) => {
    return players.find(p => p.id === playerID);
  };

  const canDelete = () => {
    if (!user) return false;
    
    // Admins can delete any match
    const isAdmin = isAdminEmail(user.email);
    if (isAdmin) return true;
    
    // Can delete if user created the match or if current player is part of the match
    if (!currentPlayer) return false;
    return match.createdByID === user.uid || match.playerIDs.includes(currentPlayer.id);
  };

  const handleDelete = async () => {
    setShowDeleteDialog(false);
    try {
      await removeMatch(match.id);
      if (onDelete) {
        onDelete();
      }
    } catch (err) {
      console.error('Error deleting match:', err);
      alert('Failed to delete match');
    }
  };

  const handleLongPressStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canDelete()) return;
    
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowDeleteDialog(true);
      // Prevent default touch behaviors when long press triggers
      if ('touches' in e) {
        e.preventDefault();
      }
    }, 500);
  };

  const handleLongPressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Prevent click action if long press was triggered
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
    }
  };

  const renderWinnerAvatar = () => {
    const game = getGame();
    let winnerId: string | undefined;
    // For team-based games, show first player of winning team
    if (game?.isTeamBased && match.teams && match.winnerTeamId) {
      winnerId = match.teams.find(t => t.teamId === match.winnerTeamId)?.playerIDs[0];
    } else {
      winnerId = match.winnerID;
    }
    const winner = winnerId ? getPlayer(winnerId) : undefined;
    if (!winner) return <span className="match-winner-avatar-empty" />;
    return <Avatar player={winner} size={40} />;
  };

  const renderMatchText = () => {
    const game = getGame();
    
    // Handle team-based games
    if (game?.isTeamBased && match.teams && match.winnerTeamId) {
      const winningTeam = match.teams.find(t => t.teamId === match.winnerTeamId);
      const otherTeams = match.teams.filter(t => t.teamId !== match.winnerTeamId);
      
      if (!winningTeam) {
        return <span>Match result unavailable</span>;
      }
      
      const winningTeamPlayers = winningTeam.playerIDs.map(id => getPlayer(id));
      
      return (
        <>
          <span>Team </span>
          {winningTeamPlayers.map((player, index) => (
            <span key={player?.id || winningTeam.playerIDs[index]}>
              {player ? (
                <AppLink to={`/players/${player.id}`} className="match-link">
                  {player.name}
                </AppLink>
              ) : (
                <span>{winningTeam.playerIDs[index]}</span>
              )}
              {index < winningTeamPlayers.length - 1 && <span>, </span>}
            </span>
          ))}
          <span> won against </span>
          {otherTeams.map((team, teamIndex) => (
            <span key={team.teamId}>
              {teamIndex > 0 && <span>, </span>}
              <span>Team </span>
              {team.playerIDs.map((playerId, playerIndex) => {
                const player = getPlayer(playerId);
                return (
                  <span key={playerId}>
                    {player ? (
                      <AppLink to={`/players/${player.id}`} className="match-link">
                        {player.name}
                      </AppLink>
                    ) : (
                      <span>{playerId}</span>
                    )}
                    {playerIndex < team.playerIDs.length - 1 && <span>, </span>}
                  </span>
                );
              })}
            </span>
          ))}
          {!hideGameTitle && game && (
            <>
              <span> at </span>
              <AppLink to={`/games/${match.gameID}`} className="match-link">
                {game.title}
              </AppLink>
            </>
          )}
        </>
      );
    }
    
    // Individual player games (existing logic)
    if (!match.winnerID || match.playerIDs.length === 0) {
      return <span>Match result unavailable</span>;
    }

    const winner = getPlayer(match.winnerID);
    const otherPlayerIDs = match.playerIDs.filter(id => id !== match.winnerID);
    
    if (otherPlayerIDs.length === 0) {
      return (
        <>
          {winner ? (
            <AppLink to={`/players/${match.winnerID}`} className="match-link">
              {winner.name}
            </AppLink>
          ) : (
            <span>{match.winnerID}</span>
          )}
          <span> won</span>
        </>
      );
    }

    const otherPlayers = otherPlayerIDs.map(id => getPlayer(id));
    
    return (
      <>
        {winner ? (
          <AppLink to={`/players/${match.winnerID}`} className="match-link">
            {winner.name}
          </AppLink>
        ) : (
          <span>{match.winnerID}</span>
        )}
        <span> beat </span>
        {otherPlayers.map((player, index) => (
          <span key={player?.id || otherPlayerIDs[index]}>
            {player ? (
              <AppLink to={`/players/${player.id}`} className="match-link">
                {player.name}
              </AppLink>
            ) : (
              <span>{otherPlayerIDs[index]}</span>
            )}
            {index < otherPlayers.length - 1 && (
              <>
                {index < otherPlayers.length - 2 && <span>, </span>}
                {index === otherPlayers.length - 2 && <span> and </span>}
              </>
            )}
          </span>
        ))}
        {!hideGameTitle && (() => {
          const game = getGame();
          return game ? (
            <>
              <span> at </span>
              <AppLink to={`/games/${match.gameID}`} className="match-link">
                {game.title}
              </AppLink>
            </>
          ) : null;
        })()}
      </>
    );
  };

  return (
    <>
      <div 
        className={`match-row ${canDelete() ? 'match-row-deletable' : ''}`}
        onMouseDown={canDelete() ? handleLongPressStart : undefined}
        onMouseUp={canDelete() ? handleLongPressEnd : undefined}
        onMouseLeave={canDelete() ? handleLongPressEnd : undefined}
        onTouchStart={canDelete() ? handleLongPressStart : undefined}
        onTouchEnd={canDelete() ? handleLongPressEnd : undefined}
        onClick={canDelete() ? handleClick : undefined}
      >
        <div className="match-main-content">
          {renderWinnerAvatar()}
          <div className="match-content">
            <div className="match-text">{renderMatchText()}</div>
            <div className="match-date">{formatDate(match.date)}</div>
          </div>
        </div>
      </div>

      {isDesktop ? (
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete Match</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this match? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Delete Match</DrawerTitle>
              <DrawerDescription>
                Are you sure you want to delete this match? This action cannot be undone.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <DrawerFooter className="px-0">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  className="w-full"
                >
                  Delete
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full">
                    Cancel
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}

