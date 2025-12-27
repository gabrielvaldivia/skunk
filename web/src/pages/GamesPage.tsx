import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGames } from "../hooks/useGames";
import { useAuth } from "../context/AuthContext";
import { useGameChampions } from "../hooks/useGameChampions";
import { useActivity } from "../hooks/useActivity";
import { useSession } from "../context/SessionContext";
import { MiniSessionSheet } from "../components/MiniSessionSheet";
import { AddGameForm } from "../components/AddGameForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Game } from "../models/Game";
import "./GamesPage.css";

export function GamesPage() {
  const navigate = useNavigate();
  const { games, isLoading, error, addGame } = useGames();
  const { isAuthenticated } = useAuth();
  const { matches, isLoading: matchesLoading } = useActivity(10000); // Get all matches to determine latest match per game
  const { currentSession } = useSession();
  const { champions } = useGameChampions(games, matches);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const cachedSortedGamesRef = useRef<Game[]>([]);

  const handleSubmitGame = async (game: Omit<Game, "id">) => {
    await addGame(game);
  };

  // Create a map of gameId -> latest match date
  const gameLatestMatchDate = useMemo(() => {
    const dateMap = new Map<string, number>();
    matches.forEach((match) => {
      if (match.gameID) {
        const currentLatest = dateMap.get(match.gameID);
        if (!currentLatest || match.date > currentLatest) {
          dateMap.set(match.gameID, match.date);
        }
      }
    });
    return dateMap;
  }, [matches]);

  // Sort games by latest match date (most recent first), then alphabetically for games with no matches
  const sortedGames = useMemo(() => {
    // Use cached sorted games if matches are still loading and we have cached games
    if (matchesLoading && matches.length === 0 && cachedSortedGamesRef.current.length > 0) {
      // Check if games have changed - if not, return cached order
      const currentGameIds = new Set(games.map(g => g.id));
      const cachedGameIds = new Set(cachedSortedGamesRef.current.map(g => g.id));
      const idsMatch = games.length === cachedSortedGamesRef.current.length &&
        games.every(g => cachedGameIds.has(g.id)) &&
        cachedSortedGamesRef.current.every(g => currentGameIds.has(g.id));
      
      if (idsMatch) {
        // Return cached order, but update with any game data changes
        return cachedSortedGamesRef.current.map(cachedGame => {
          const updatedGame = games.find(g => g.id === cachedGame.id);
          return updatedGame || cachedGame;
        });
      }
    }

    const sorted = [...games].sort((a, b) => {
      const aDate = gameLatestMatchDate.get(a.id) || 0;
      const bDate = gameLatestMatchDate.get(b.id) || 0;
      
      // Games with matches come first, sorted by latest match date (descending)
      if (aDate > 0 && bDate > 0) {
        return bDate - aDate;
      }
      // Games with matches come before games without matches
      if (aDate > 0) return -1;
      if (bDate > 0) return 1;
      // Games without matches sorted alphabetically
      return a.title.localeCompare(b.title);
    });

    // Cache the sorted games
    cachedSortedGamesRef.current = sorted;

    return sorted;
  }, [games, gameLatestMatchDate, matches, matchesLoading]);

  // Filter games based on search query
  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortedGames;
    }

    const query = searchQuery.toLowerCase().trim();
    return sortedGames.filter((game) =>
      game.title.toLowerCase().includes(query)
    );
  }, [sortedGames, searchQuery]);

  if (isLoading) {
    return <div className="loading">Loading games...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="games-page">
      <div className="page-header">
        <h1>Games</h1>
        {isAuthenticated && (
          <>
            <Button onClick={() => setShowAddForm(true)}>+ Add Game</Button>
            <AddGameForm
              open={showAddForm}
              onOpenChange={setShowAddForm}
              onSubmit={handleSubmitGame}
            />
          </>
        )}
      </div>

      {currentSession && <MiniSessionSheet />}

      {games.length > 0 && (
        <div className="search-container">
          <Input
            type="text"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      )}

      {games.length === 0 ? (
        <div className="empty-state">
          <p>No games yet</p>
          {isAuthenticated ? (
            <p className="empty-hint">
              Click "Add Game" to create your first game
            </p>
          ) : (
            <p className="empty-hint">Sign in to create games</p>
          )}
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="empty-state">
          <p>No games found matching "{searchQuery}"</p>
          <p className="empty-hint">Try a different search term</p>
        </div>
      ) : (
        <div className="games-list">
          {filteredGames.map((game) => {
            const champion = champions.get(game.id);
            return (
              <div
                key={game.id}
                className="game-list-item"
                onClick={() => navigate(`/games/${game.id}`)}
              >
                <div className="game-list-content">
                  <div className="game-cover-art-container">
                    <div className="game-cover-art-placeholder">
                      {game.title.charAt(0).toUpperCase()}
                    </div>
                    {game.coverArt && (
                      <img 
                        src={game.coverArt} 
                        alt={game.title}
                        className="game-cover-art"
                        onError={(e) => {
                          // Hide image if it fails to load, placeholder will show
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  <div className="game-list-name-wrapper">
                    <div className="game-list-name">{game.title}</div>
                    {champion && champion.playerName && (
                      <div className="game-list-champion">
                        🏆 {champion.playerName}
                        {champion.winCount > 1 && ` (${champion.winCount} wins)`}
                      </div>
                    )}
                    {champion && !champion.playerName && champion.winCount === 0 && (
                      <div className="game-list-champion no-champion">No matches yet</div>
                    )}
                  </div>
                </div>
                <div className="game-list-champion-desktop">
                  {champion && champion.playerName && (
                    <div className="game-list-champion">
                      🏆 {champion.playerName}
                      {champion.winCount > 1 && ` (${champion.winCount} wins)`}
                    </div>
                  )}
                  {champion && !champion.playerName && champion.winCount === 0 && (
                    <div className="game-list-champion no-champion">No matches yet</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
