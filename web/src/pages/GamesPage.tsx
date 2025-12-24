import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGames } from "../hooks/useGames";
import { useAuth } from "../context/AuthContext";
import { GameCard } from "../components/GameCard";
import { AddGameForm } from "../components/AddGameForm";
import { Button } from "@/components/ui/button";
import type { Game } from "../models/Game";
import "./GamesPage.css";

export function GamesPage() {
  const navigate = useNavigate();
  const { games, isLoading, error, addGame } = useGames();
  const { isAuthenticated } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);

  const handleSubmitGame = async (game: Omit<Game, "id">) => {
    await addGame(game);
  };

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
      ) : (
        <div className="games-grid">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onClick={() => navigate(`/games/${game.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
