import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGames } from "../hooks/useGames";
import { useAuth } from "../context/AuthContext";
import { useGameChampions } from "../hooks/useGameChampions";
import { useActivity } from "../hooks/useActivity";
import { useSession } from "../context/SessionContext";
import { MiniSessionSheet } from "../components/MiniSessionSheet";
import { AddGameForm } from "../components/AddGameForm";
import { ChevronRightIcon, TrophyIcon } from "../components/icons";
import type { Game } from "../models/Game";
import "./GamesPage.css";
import { GamesHeader } from "../components/GamesHeader";
import { useSearchQuery } from "../hooks/useSearchQuery";
import { useGameScope, useMyGameIds } from "../hooks/useGameScope";

export function GamesPage() {
  const navigate = useNavigate();
  const { games, isLoading, error, addGame } = useGames();
  const { isAuthenticated } = useAuth();
  const { matches } = useActivity(10000); // Get all matches to determine latest match per game
  const { currentSession } = useSession();
  const { champions } = useGameChampions(games, matches);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useSearchQuery();
  const [scope, setScope] = useGameScope();
  const { ids: myIds } = useMyGameIds(games);

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

    return sorted;
  }, [games, gameLatestMatchDate]);

  // Filter games based on search query
  const filteredGames = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    // Searching always covers every game, whichever tab you're on
    const scoped = scope === "mine" && !query ? sortedGames.filter((g) => myIds.has(g.id)) : sortedGames;
    return query ? scoped.filter((game) => game.title.toLowerCase().includes(query)) : scoped;
  }, [sortedGames, searchQuery, scope, myIds]);

  if (isLoading) {
    return <div className="loading">Loading games...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="games-page">
      <GamesHeader
        scope={scope}
        onScopeChange={setScope}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onAdd={() => (isAuthenticated ? setShowAddForm(true) : navigate("/signin"))}
      />
      {isAuthenticated && (
        <AddGameForm open={showAddForm} onOpenChange={setShowAddForm} onSubmit={handleSubmitGame} />
      )}

      {currentSession && <MiniSessionSheet />}

      {/* Clears the floating header */}
      <div className="page-content" style={{ paddingTop: "calc(var(--safe-top) + 0.75rem + 3rem + 1rem)" }}>
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
          <div className="games-list list">
            {filteredGames.map((game) => {
              const champion = champions.get(game.id);
              return (
                <button
                  type="button"
                  key={game.id}
                  className="game-list-item row-press"
                  onClick={() => navigate(`/games/${game.id}`)}
                >
                  <div className="game-cover-art-container">
                    <div className="game-cover-art-placeholder">
                      {game.title.charAt(0).toUpperCase()}
                    </div>
                    {game.coverArt && (
                      <img
                        src={game.coverArt}
                        alt=""
                        className="game-cover-art"
                        loading="lazy"
                        onError={(e) => {
                          // Hide image if it fails to load, placeholder will show
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  <div className="game-list-name-wrapper">
                    <div className="game-list-name">{game.title}</div>
                    {champion && champion.playerName ? (
                      <div className="game-list-champion">
                        <TrophyIcon className="game-list-trophy" aria-hidden />
                        <span>
                          {champion.playerName}
                          {champion.winCount > 1 && ` · ${champion.winCount} wins`}
                        </span>
                      </div>
                    ) : (
                      <div className="game-list-champion">No matches yet</div>
                    )}
                  </div>
                  <ChevronRightIcon className="game-list-chevron" aria-hidden />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
