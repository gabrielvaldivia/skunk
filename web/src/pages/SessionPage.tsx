import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useAuth } from "../context/AuthContext";
import { usePlayers } from "../hooks/usePlayers";
import { useMatches } from "../hooks/useMatches";
import { useGames } from "../hooks/useGames";
import { heartGame } from "../hooks/useGameScope";
import { setSessionGame, subscribeToMatchesForSession } from "../services/databaseService";
import { PlayerCard } from "../components/PlayerCard";
import { MatchRow } from "../components/MatchRow";
import { AddMatchForm } from "../components/AddMatchForm";
import { Button } from "@/components/ui/button";
import { PlusIcon, ShareIcon } from "../components/icons";
import { NavBar } from "../components/NavBar";
import { toast } from "sonner";
import { getMatchWinnerID, type Match } from "../models/Match";
import type { Player } from "../models/Player";
import "./SessionPage.css";

export function SessionPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const {
    currentSession,
    joinSession,
    leaveSession,
    refreshSession,
    isLoading: sessionContextLoading,
  } = useSession();
  const { player, isAuthenticated, refreshPlayer } = useAuth();
  const { players, isLoading: playersLoading } = usePlayers();
  const { addMatch } = useMatches();
  const { games } = useGames();
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sessionParticipants, setSessionParticipants] = useState<Player[]>([]);
  const [sessionMatches, setSessionMatches] = useState<Match[]>([]);
  const [matchesLoadedFor, setMatchesLoadedFor] = useState<string | null>(null);
  const [lastSelectedGameId, setLastSelectedGameId] = useState<
    string | undefined
  >(undefined);

  // Auto-join session when code is in URL and user is authenticated
  useEffect(() => {
    const handleAutoJoin = async () => {
      if (!code || !isAuthenticated || !player || sessionContextLoading) {
        return;
      }

      // Check if we're already in this session
      if (currentSession?.code === code) {
        return;
      }

      // If we're in a different session, leave it first (optional - could also allow multiple sessions)
      // For now, we'll just join the new session

      setIsJoining(true);
      setError(null);
      try {
        await joinSession(code);
        await refreshSession();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to join session";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsJoining(false);
      }
    };

    handleAutoJoin();
  }, [
    code,
    isAuthenticated,
    player,
    sessionContextLoading,
    currentSession?.code,
    joinSession,
    refreshSession,
  ]);

  // Update session participants when session or players change
  useEffect(() => {
    if (currentSession && players.length > 0) {
      const participants = currentSession.participantIDs
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => p !== undefined);
      setSessionParticipants(participants);
    } else {
      setSessionParticipants([]);
    }
  }, [currentSession, players]);

  // Live matches for this session (participants stay live via SessionContext)
  useEffect(() => {
    if (!code) return;
    return subscribeToMatchesForSession(
      code,
      (matches) => {
        setSessionMatches(matches);
        setMatchesLoadedFor(code);
      },
      (error) => {
        console.error("Error fetching session matches:", error);
        setMatchesLoadedFor(code);
      }
    );
  }, [code]);
  const isLoadingMatches = !!code && matchesLoadedFor !== code;

  const participantWinCounts = useMemo(() => {
    const counts = new Map(sessionParticipants.map((participant) => [participant.id, 0]));
    const gamesById = new Map(games.map((game) => [game.id, game]));

    sessionMatches.forEach((match) => {
      const game = gamesById.get(match.gameID);
      if (!game) return;

      const winnerOrTeamId = getMatchWinnerID(match, game);
      if (!winnerOrTeamId) return;

      if (game.isTeamBased) {
        const winningTeam = match.teams?.find((team) => team.teamId === winnerOrTeamId);
        winningTeam?.playerIDs.forEach((playerId) => {
          if (counts.has(playerId)) counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
        });
      } else if (counts.has(winnerOrTeamId)) {
        counts.set(winnerOrTeamId, (counts.get(winnerOrTeamId) ?? 0) + 1);
      }
    });

    return counts;
  }, [games, sessionMatches, sessionParticipants]);

  const rankedParticipants = useMemo(
    () =>
      sessionParticipants
        .map((participant, sessionOrder) => ({ participant, sessionOrder }))
        .sort((a, b) => {
          const winsDifference =
            (participantWinCounts.get(b.participant.id) ?? 0) -
            (participantWinCounts.get(a.participant.id) ?? 0);
          return winsDifference || a.sessionOrder - b.sessionOrder;
        })
        .map(({ participant }) => participant),
    [participantWinCounts, sessionParticipants]
  );

  const gamesPlayed = useMemo(() => {
    const matchCounts = new Map<string, number>();
    sessionMatches.forEach((match) => {
      matchCounts.set(match.gameID, (matchCounts.get(match.gameID) ?? 0) + 1);
    });

    return Array.from(matchCounts, ([gameId, matchCount]) => ({
      gameId,
      matchCount,
      title: games.find((game) => game.id === gameId)?.title ?? "Unknown game",
    })).sort((a, b) => b.matchCount - a.matchCount || a.title.localeCompare(b.title));
  }, [games, sessionMatches]);

  // Load last selected game for this session from localStorage
  useEffect(() => {
    if (!code) return;
    try {
      const stored = localStorage.getItem(`session:lastGame:${code}`);
      if (stored) {
        setLastSelectedGameId(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, [code]);

  // Named after the last game played: the newest match, else the session's game
  const latestMatch = sessionMatches.reduce<Match | undefined>((a, m) => (!a || m.date > a.date ? m : a), undefined);
  const sessionGameId = latestMatch?.gameID ?? currentSession?.gameID;
  const sessionTitle = games.find((g) => g.id === sessionGameId)?.title ?? `Session ${code}`;

  // Keep the session's game in step with its newest match, so the session pill
  // and My Sessions (which only read the session) show the same name. Covers
  // matches saved before sessions were named, and edits that change the game.
  useEffect(() => {
    if (!currentSession || currentSession.code !== code || matchesLoadedFor !== code) return;
    const latest = latestMatch?.gameID;
    if (latest && latest !== currentSession.gameID) {
      setSessionGame(currentSession.id, latest).catch((err) => console.error("Error naming session:", err));
    }
  }, [currentSession, code, matchesLoadedFor, latestMatch?.gameID]);

  const handleShare = async () => {
    if (!code) return;

    const url = `${window.location.origin}/session/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: sessionTitle,
          text: "Join my session on Skunk",
          url,
        });
      } catch {
        // User may cancel share; no toast needed
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Session link copied");
      } catch {
        toast.error("Failed to share link");
      }
    }
  };

  const handleLeave = async () => {
    if (!currentSession || !player) return;

    setIsLeaving(true);
    try {
      await leaveSession();
      toast.success("Left session");
      // Back to the shelf; replace, since going back to the session page would rejoin it
      navigate("/games", { replace: true });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to leave session";
      toast.error(errorMessage);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleSubmitMatch = async (match: Omit<Match, "id">) => {
    await addMatch(match);
    // The session takes the name of the game just played
    if (currentSession && match.gameID && currentSession.gameID !== match.gameID) {
      setSessionGame(currentSession.id, match.gameID).catch((err) => console.error("Error naming session:", err));
    }
    // Playing a game hearts it into My Games, even if you'd un-hearted it before
    if (player && match.gameID && match.playerIDs.includes(player.id)) {
      heartGame(player, match.gameID, refreshPlayer).catch((err) => console.error("Error hearting game:", err));
    }
    // Remember the last selected game for this session
    if (code && match.gameID) {
      try {
        localStorage.setItem(`session:lastGame:${code}`, match.gameID);
        setLastSelectedGameId(match.gameID);
      } catch {
        // ignore storage errors
      }
    }
    setShowAddForm(false);
  };

  if (!code) {
    return (
      <div className="session-page">
        <div className="error">Invalid session code</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="session-page">
        <div className="error">Please sign in to join a session</div>
      </div>
    );
  }

  if (isJoining || sessionContextLoading) {
    return (
      <div className="session-page">
        <div className="loading">Joining session...</div>
      </div>
    );
  }

  if (error && !currentSession) {
    return (
      <div className="session-page">
        <div className="error">{error}</div>
        <Button onClick={() => navigate("/activity")} className="mt-4">
          Go to Activity
        </Button>
      </div>
    );
  }

  if (!currentSession || currentSession.code !== code) {
    return (
      <div className="session-page">
        <div className="loading">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="session-page">
      <NavBar
        title={sessionTitle}
        action={
          <Button
            variant="secondary"
            size="icon"
            onClick={handleShare}
            aria-label="Share session link"
          >
            <ShareIcon />
          </Button>
        }
      />

      <div className="session-content page-content">
        <section className="participants-section">
          <h2 className="section-title">Players · {sessionParticipants.length}</h2>
          {playersLoading ? (
            <div className="loading">Loading participants...</div>
          ) : sessionParticipants.length === 0 ? (
            <div className="empty-state">No participants yet</div>
          ) : (
            <div className="participants-grid list">
              {rankedParticipants.map((participant) => {
                const wins = participantWinCounts.get(participant.id) ?? 0;
                return (
                  <PlayerCard
                    key={participant.id}
                    player={participant}
                    subtitle={`${wins} ${wins === 1 ? "win" : "wins"}`}
                    rightAction={
                      player && participant.id === player.id ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="button-leave"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLeave();
                          }}
                          disabled={isLeaving}
                        >
                          {isLeaving ? "Leaving..." : "Leave"}
                        </Button>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="session-games-section">
          <h2 className="section-title">Games Played · {gamesPlayed.length}</h2>
          {isLoadingMatches ? (
            <div className="loading">Loading games...</div>
          ) : gamesPlayed.length === 0 ? (
            <div className="empty-state">No games played yet</div>
          ) : (
            <div className="session-games-list list">
              {gamesPlayed.map(({ gameId, matchCount, title }) => (
                <div className="session-game-row" key={gameId}>
                  <span className="session-game-title">{title}</span>
                  <span className="session-game-count">
                    {matchCount} {matchCount === 1 ? "match" : "matches"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="matches-section">
          <div className="matches-section-header">
            <h2 className="section-title">Matches · {sessionMatches.length}</h2>
          </div>
          {isLoadingMatches ? (
            <div className="loading">Loading matches...</div>
          ) : sessionMatches.length === 0 ? (
            <div className="empty-state">No matches yet</div>
          ) : (
            <div className="matches-list">
              {sessionMatches.map((match) => (
                <MatchRow key={match.id} match={match} hideGameTitle={false} />
              ))}
            </div>
          )}
        </section>
      </div>

      {games.length > 0 && sessionParticipants.length > 0 && (
        <Button
          onClick={() => setShowAddForm(true)}
          className="floating-cta"
          size="lg"
        >
          <PlusIcon className="!size-5" />
          New Match
        </Button>
      )}

      <AddMatchForm
        open={showAddForm}
        onOpenChange={setShowAddForm}
        onSubmit={handleSubmitMatch}
        defaultGameId={lastSelectedGameId || currentSession.gameID}
        sessionParticipants={sessionParticipants}
        sessionCode={code}
      />
    </div>
  );
}
