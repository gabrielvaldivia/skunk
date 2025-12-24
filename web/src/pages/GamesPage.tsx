import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGames } from "../hooks/useGames";
import { useAuth } from "../context/AuthContext";
import { useGameChampions } from "../hooks/useGameChampions";
import { AddGameForm } from "../components/AddGameForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Game } from "../models/Game";
import "./GamesPage.css";

const ADMIN_EMAIL = "valdivia.gabriel@gmail.com";

export function GamesPage() {
  const navigate = useNavigate();
  const { games, isLoading, error, addGame } = useGames();
  const { isAuthenticated, user } = useAuth();
  const { champions, isLoading: championsLoading } = useGameChampions(games);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleSubmitGame = async (game: Omit<Game, "id">) => {
    await addGame(game);
  };

  // Filter games based on search query
  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) {
      return games;
    }

    const query = searchQuery.toLowerCase().trim();
    return games.filter((game) =>
      game.title.toLowerCase().includes(query)
    );
  }, [games, searchQuery]);

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
        {isAuthenticated && isAdmin && (
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
                  <div className="game-list-name">{game.title}</div>
                </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
