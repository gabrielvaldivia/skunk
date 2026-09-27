import { useState } from 'react';
import { AppLink } from './AppLink';
import type { Match } from '../models/Match';
import { usePlayers } from '../hooks/usePlayers';
import { useGames } from '../hooks/useGames';
import { useAuth } from '../context/AuthContext';
import { useMatches } from '../hooks/useMatches';
import type { FieldUpdates } from '../services/databaseService';
import { AddMatchForm } from './AddMatchForm';
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
import { MoreIcon } from "./icons";

interface MatchRowProps {
  match: Match;
  hideGameTitle?: boolean;
  onDelete?: () => void;
}

export function MatchRow({ match, hideGameTitle = false, onDelete }: MatchRowProps) {
  const { players } = usePlayers();
  const { games } = useGames();
  const { player: currentPlayer } = useAuth();
  const { removeMatch, editMatch } = useMatches();
  // The row's options button opens a menu (Edit / Delete); Delete asks to confirm
  const [sheet, setSheet] = useState<'actions' | 'confirmDelete' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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

  // Match history is shared, but only participants can alter its result.
  const canManageMatch = !!currentPlayer && match.playerIDs.includes(currentPlayer.id);

  const startEditing = () => {
    setSheet(null);
    // Let the menu's sheet finish closing before the form's opens
    setTimeout(() => setIsEditing(true), 250);
  };

  // Save over the original, keeping its date, creator and session. Winner and
  // team fields are cleared (null) when the edit no longer has them.
  const handleSaveEdit = async (edited: Omit<Match, 'id'>) => {
    const updates: FieldUpdates<Match> = {
      gameID: edited.gameID,
      playerIDs: edited.playerIDs,
      playerOrder: edited.playerOrder,
      scores: edited.scores,
      rounds: edited.rounds,
      isMultiplayer: edited.isMultiplayer,
      winnerID: edited.winnerID ?? null,
      winnerTeamId: edited.winnerTeamId ?? null,
      teams: edited.teams ?? null,
    };
    await editMatch(match.id, updates);
  };

  const handleDelete = async () => {
    setSheet(null);
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
                <span>Unknown player</span>
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
                      <span>Unknown player</span>
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
            <span>Unknown player</span>
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
          <span>Unknown player</span>
        )}
        <span> beat </span>
        {otherPlayers.map((player, index) => (
          <span key={player?.id || otherPlayerIDs[index]}>
            {player ? (
              <AppLink to={`/players/${player.id}`} className="match-link">
                {player.name}
              </AppLink>
            ) : (
              <span>Unknown player</span>
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
      <div className="match-row">
        <div className="match-main-content">
          {renderWinnerAvatar()}
          <div className="match-content">
            <div className="match-text">{renderMatchText()}</div>
            <div className="match-date">{formatDate(match.date)}</div>
          </div>
          {canManageMatch && (
            <button
              type="button"
              className="match-options-button"
              aria-label="Match options"
              onClick={() => setSheet('actions')}
            >
              <MoreIcon className="match-options-icon" />
            </button>
          )}
        </div>
      </div>

      {isDesktop ? (
        <Dialog open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
          <DialogContent className="sm:max-w-[425px]">
            {sheet === 'confirmDelete' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Delete Match</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this match? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSheet(null)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete}>
                    Delete
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Match</DialogTitle>
                  <DialogDescription>Fix who played, the scores or the winner, or remove it.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="destructive" onClick={() => setSheet('confirmDelete')}>
                    Delete
                  </Button>
                  <Button onClick={startEditing}>Edit Match</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
          <DrawerContent>
            {sheet === 'confirmDelete' ? (
              <>
                <DrawerHeader className="text-left">
                  <DrawerTitle>Delete Match</DrawerTitle>
                  <DrawerDescription>
                    Are you sure you want to delete this match? This action cannot be undone.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4 pb-4">
                  <DrawerFooter className="px-0">
                    <Button variant="destructive" onClick={handleDelete} className="w-full">
                      Delete
                    </Button>
                    <DrawerClose asChild>
                      <Button variant="outline" className="w-full">
                        Cancel
                      </Button>
                    </DrawerClose>
                  </DrawerFooter>
                </div>
              </>
            ) : (
              <>
                <DrawerHeader className="text-left">
                  <DrawerTitle>Match</DrawerTitle>
                  <DrawerDescription>Fix who played, the scores or the winner, or remove it.</DrawerDescription>
                </DrawerHeader>
                <div className="px-4 pb-4">
                  <DrawerFooter className="px-0">
                    <Button onClick={startEditing} className="w-full">
                      Edit Match
                    </Button>
                    <Button variant="destructive" onClick={() => setSheet('confirmDelete')} className="w-full">
                      Delete
                    </Button>
                  </DrawerFooter>
                </div>
              </>
            )}
          </DrawerContent>
        </Drawer>
      )}

      {isEditing && (
        <AddMatchForm open={isEditing} onOpenChange={setIsEditing} onSubmit={handleSaveEdit} editing={match} />
      )}
    </>
  );
}
