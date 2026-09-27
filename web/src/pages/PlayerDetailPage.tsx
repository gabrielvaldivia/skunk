import { useParams } from "react-router-dom";
import { usePlayers } from "../hooks/usePlayers";
import { useActivity } from "../hooks/useActivity";
import { useGames } from "../hooks/useGames";
import { MatchRow } from "../components/MatchRow";
import { NavBar } from "../components/NavBar";
import { Avatar } from "../components/Avatar";
import { LocationIcon } from "../components/icons";
import { GameStatsCarousel } from "../components/GameStatsCarousel";
import { getMatchWinnerID, type Match } from "../models/Match";
import "./PlayerDetailPage.css";

/** `playerId` shows that player instead of the one in the URL, e.g. in a panel */
export function PlayerDetailPage({ playerId }: { playerId?: string } = {}) {
  const params = useParams<{ id: string }>();
  const id = playerId ?? params.id;
  const { players } = usePlayers();
  const { matches: allMatches } = useActivity(10000); // Full history for stats; shares the listener with list pages
  const { games } = useGames();

  const player = players.find((p) => p.id === id);
  const playerMatches: Match[] = allMatches
    .filter((m) => m.playerIDs.includes(id || ""))
    .map((match) => ({
      ...match,
      game: games.find((g) => g.id === match.gameID) || undefined,
    }));

  if (!player) {
    return (
      <div className="player-detail-page">
        <div className="error">Player not found</div>
      </div>
    );
  }

  const resolvedPlayerId = player.id;
  const didWinMatch = (match: Match) => {
    const matchGame = games.find((game) => game.id === match.gameID);
    const winnerOrTeamId = matchGame
      ? getMatchWinnerID(match, matchGame)
      : match.winnerID ?? match.winnerTeamId;
    if (!winnerOrTeamId) return false;

    if (matchGame?.isTeamBased || match.winnerTeamId) {
      return !!match.teams
        ?.find((team) => team.teamId === winnerOrTeamId)
        ?.playerIDs.includes(resolvedPlayerId);
    }
    return winnerOrTeamId === resolvedPlayerId;
  };

  const wins = playerMatches.filter(didWinMatch).length;
  const topGames = games
    .map((game) => {
      const matches = playerMatches.filter((match) => match.gameID === game.id);
      return {
        game,
        matches: matches.length,
        wins: matches.filter(didWinMatch).length,
      };
    })
    .filter(({ matches }) => matches > 0)
    .sort((a, b) => b.wins - a.wins || b.matches - a.matches || a.game.title.localeCompare(b.game.title))
    .slice(0, 5);
  const bestWinStreak = (() => {
    const sortedMatches = [...playerMatches].sort((a, b) => a.date - b.date);
    let current = 0;
    let best = 0;
    for (const m of sortedMatches) {
      if (didWinMatch(m)) {
        current += 1;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    return best;
  })();

  return (
    <div className="player-detail-page">
      <NavBar />
      <div className="player-hero">
        <Avatar player={player} size={96} />
        <h1 className="player-hero-name">{player.name}</h1>
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
              items={topGames.map(({ game, matches, wins: gameWins }) => ({
                game,
                gameId: game.id,
                title: game.title,
                subtitle: `${gameWins} ${gameWins === 1 ? "win" : "wins"} · ${matches} ${
                  matches === 1 ? "match" : "matches"
                }`,
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
                <MatchRow key={match.id} match={match} hideGameTitle={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
