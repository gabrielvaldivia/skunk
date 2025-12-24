import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '../models/Match';
import type { Player } from '../models/Player';
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

const ADMIN_EMAIL = "valdivia.gabriel@gmail.com";

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
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPlayer = (playerID: string) => {
    return players.find(p => p.id === playerID);
  };

  const getPlayerColor = (player: Player) => {
    if (player.colorData) {
      return player.colorData;
    }
    const hash = player.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const canDelete = () => {
    if (!user) return false;
    
    // Admins can delete any match
    const isAdmin = user.email === ADMIN_EMAIL;
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
    
    // For team-based games, show first player of winning team
    if (game?.isTeamBased && match.teams && match.winnerTeamId) {
      const winningTeam = match.teams.find(t => t.teamId === match.winnerTeamId);
      if (winningTeam && winningTeam.playerIDs.length > 0) {
        const firstPlayer = getPlayer(winningTeam.playerIDs[0]);
        if (firstPlayer) {
          const backgroundColor = getPlayerColor(firstPlayer);
          return (
            <div 
              className="match-winner-avatar" 
              style={{ backgroundColor }}
            >
              {firstPlayer.photoData ? (
                <img src={`data:image/jpeg;base64,${firstPlayer.photoData}`} alt={firstPlayer.name} />
              ) : (
                <span className="match-winner-initials">{getInitials(firstPlayer.name)}</span>
              )}
            </div>
          );
        }
      }
      return null;
    }
    
    // Individual player games (existing logic)
    const winner = match.winnerID ? getPlayer(match.winnerID) : undefined;
    if (!winner) return null;
    
    const backgroundColor = getPlayerColor(winner);
    
    return (
      <div 
        className="match-winner-avatar" 
        style={{ backgroundColor }}
      >
        {winner.photoData ? (
          <img src={`data:image/jpeg;base64,${winner.photoData}`} alt={winner.name} />
        ) : (
          <span className="match-winner-initials">{getInitials(winner.name)}</span>
        )}
      </div>
    );
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
      const otherTeamPlayers = otherTeams.flatMap(team => 
        team.playerIDs.map(id => getPlayer(id))
      );
      
      return (
        <>
          <span>Team </span>
          {winningTeamPlayers.map((player, index) => (
            <span key={player?.id || winningTeam.playerIDs[index]}>
              {player ? (
                <Link to={`/players/${player.id}`} className="match-link">
                  {player.name}
                </Link>
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
                      <Link to={`/players/${player.id}`} className="match-link">
                        {player.name}
                      </Link>
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
              <Link to={`/games/${match.gameID}`} className="match-link">
                {game.title}
              </Link>
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
            <Link to={`/players/${match.winnerID}`} className="match-link">
              {winner.name}
            </Link>
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
          <Link to={`/players/${match.winnerID}`} className="match-link">
            {winner.name}
          </Link>
        ) : (
          <span>{match.winnerID}</span>
        )}
        <span> beat </span>
        {otherPlayers.map((player, index) => (
          <span key={player?.id || otherPlayerIDs[index]}>
            {player ? (
              <Link to={`/players/${player.id}`} className="match-link">
                {player.name}
              </Link>
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
              <Link to={`/games/${match.gameID}`} className="match-link">
                {game.title}
              </Link>
            </>
          ) : null;
        })()}
      </>
    );
  };

  const game = getGame();
  const winner = match.winnerID ? getPlayer(match.winnerID) : undefined;
  const winningTeam = game?.isTeamBased && match.teams && match.winnerTeamId 
    ? match.teams.find(t => t.teamId === match.winnerTeamId) 
    : undefined;

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

