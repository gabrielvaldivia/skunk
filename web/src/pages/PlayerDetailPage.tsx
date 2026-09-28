import { useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { usePlayers } from "../hooks/usePlayers";
import { useActivity } from "../hooks/useActivity";
import { useGames } from "../hooks/useGames";
import { MatchRow } from "../components/MatchRow";
import { NavBar } from "../components/NavBar";
import { Avatar } from "../components/Avatar";
import { LocationIcon } from "../components/icons";
import { GameStatsCarousel } from "../components/GameStatsCarousel";
import { Button } from "@/components/ui/button";
import { usePlayerFollow } from "../hooks/useFriends";
import { getMatchWinnerID, type Match } from "../models/Match";
import { toast } from "sonner";
import "./PlayerDetailPage.css";

/** `playerId` shows that player instead of the one in the URL, e.g. in a panel */
export function PlayerDetailPage({ playerId }: { playerId?: string } = {}) {
  const params = useParams<{ id: string }>();
  // The name, which the panel's header picks up once it scrolls away
  const heading = useRef<HTMLHeadingElement>(null);
  const id = playerId ?? params.id;
  const { players, isLoading: playersLoading } = usePlayers();
  const { matches: allMatches } = useActivity(10000); // Full history for stats; shares the listener with list pages
  const { games } = useGames();
  const follow = usePlayerFollow(id);

  const player = players.find((p) => p.id === id);
  const resolvedPlayerId = player?.id;

  // Stats over the full match history, recomputed only when the data changes
  const { playerMatches, wins, topGames, bestWinStreak } = useMemo(() => {
    const gamesById = new Map(games.map((g) => [g.id, g]));
    const playerMatches: Match[] = allMatches
      .filter((m) => m.playerIDs.includes(id || ""))
      .map((match) => ({ ...match, game: gamesById.get(match.gameID) }));

    const didWinMatch = (match: Match) => {
      if (!resolvedPlayerId) return false;
      const matchGame = gamesById.get(match.gameID);
      const winnerOrTeamId = matchGame
        ? getMatchWinnerID(match, matchGame)
        : match.winnerID ?? match.winnerTeamId;
      if (!winnerOrTeamId) return false;
      // A winning team credits each of its players (as the game leaderboard
      // does); otherwise the winner is a player
      const team = match.teams?.find((t) => t.teamId === winnerOrTeamId);
      return team ? team.playerIDs.includes(resolvedPlayerId) : winnerOrTeamId === resolvedPlayerId;
    };
    const won = new Set(playerMatches.filter(didWinMatch).map((m) => m.id));

    const byGame = new Map<string, { matches: number; wins: number }>();
    for (const m of playerMatches) {
      const entry = byGame.get(m.gameID) ?? { matches: 0, wins: 0 };
      entry.matches++;
      if (won.has(m.id)) entry.wins++;
      byGame.set(m.gameID, entry);
    }
    const topGames = games
      .map((game) => ({ game, ...(byGame.get(game.id) ?? { matches: 0, wins: 0 }) }))
      .filter(({ wins }) => wins > 0)
      .sort((a, b) => b.wins - a.wins || b.matches - a.matches || a.game.title.localeCompare(b.game.title))
      .slice(0, 5);

    let current = 0;
    let bestWinStreak = 0;
    for (const m of [...playerMatches].sort((a, b) => a.date - b.date)) {
      if (won.has(m.id)) {
        current += 1;
        if (current > bestWinStreak) bestWinStreak = current;
      } else {
        current = 0;
      }
    }
    return { playerMatches, wins: won.size, topGames, bestWinStreak };
  }, [allMatches, games, id, resolvedPlayerId]);

  if (!player) {
    // Opened by link, the players may still be on their way
    if (playersLoading) return <div className="loading">Loading...</div>;
    return (
      <div className="player-detail-page">
        <div className="error">Player not found</div>
      </div>
    );
  }

  const handleFollowToggle = async () => {
    try {
      await follow.toggle();
    } catch (error) {
      console.error("Error updating follow:", error);
      toast.error("Couldn't update this friend.");
    }
  };

  return (
    <div className="player-detail-page">
      <NavBar
        scrollTitle={player.name}
        scrollAnchor={heading}
        action={
          follow.canFollow && (
            <Button
              type="button"
              variant={follow.following ? "secondary" : "default"}
              className="player-follow-button rounded-full"
              disabled={follow.isSaving}
              onClick={handleFollowToggle}
            >
              {follow.isSaving ? "Saving..." : follow.following ? "Unfollow" : "Follow"}
            </Button>
          )
        }
      />
      <div className="player-hero">
        <Avatar player={player} size={96} />
        <h1 ref={heading} className="player-hero-name">{player.name}</h1>
        {player.location && (
          <div className="player-location">
            <LocationIcon aria-hidden />
            {player.location}
          </div>
        )}
        {player.bio && <p className="player-bio">{player.bio}</p>}
      </div>

      <div className="page-content">
        <div className="player-stats">
          <div className="stat-item">
            <span className="stat-value">{playerMatches.length}</span>
            <span className="stat-label">Matches</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{wins}</span>
            <span className="stat-label">Wins</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{bestWinStreak}</span>
            <span className="stat-label">Best Streak</span>
          </div>
        </div>

        {topGames.length > 0 && (
          <section className="player-top-games">
            <h2 className="section-title">Top Games</h2>
            <GameStatsCarousel
              items={topGames.map(({ game, wins: gameWins }) => ({
                game,
                gameId: game.id,
                title: game.title,
                subtitle: `${gameWins} ${gameWins === 1 ? "win" : "wins"}`,
              }))}
            />
          </section>
        )}

        <div className="matches-section">
          <h2 className="section-title">Match History</h2>
          {playerMatches.length === 0 ? (
            <div className="empty-state">
              <p>No matches yet</p>
            </div>
          ) : (
            <div className="matches-list">
              {playerMatches.map((match) => (
                <MatchRow key={match.id} match={match} hideGameTitle={false} shortNames showGameBox />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
