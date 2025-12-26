import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useAuth } from "../context/AuthContext";
import { usePlayers } from "../hooks/usePlayers";
import { useMatches } from "../hooks/useMatches";
import { useGames } from "../hooks/useGames";
import { getMatchesForSession } from "../services/databaseService";
import { PlayerCard } from "../components/PlayerCard";
import { MatchRow } from "../components/MatchRow";
import { AddMatchForm } from "../components/AddMatchForm";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import type { Match } from "../models/Match";
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
  const { player, isAuthenticated } = useAuth();
  const { players, isLoading: playersLoading } = usePlayers();
  const { addMatch } = useMatches();
  const { games } = useGames();
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sessionParticipants, setSessionParticipants] = useState<Player[]>([]);
  const [sessionMatches, setSessionMatches] = useState<Match[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);

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

  // Fetch matches for this session
  useEffect(() => {
    if (!code) return;

    const fetchMatches = async () => {
      setIsLoadingMatches(true);
      try {
        const matches = await getMatchesForSession(code);
        setSessionMatches(matches);
      } catch (error) {
        console.error("Error fetching session matches:", error);
      } finally {
        setIsLoadingMatches(false);
      }
    };

    fetchMatches();

    // Refresh matches periodically
    const interval = setInterval(fetchMatches, 5000);
    return () => clearInterval(interval);
  }, [code]);

  // Periodic refresh to get updated participants
  useEffect(() => {
    if (!currentSession || currentSession.code !== code) {
      return;
    }

    const interval = setInterval(() => {
      refreshSession();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [currentSession, code, refreshSession]);

  const handleCopyUrl = async () => {
    if (!code) return;

    const url = `${window.location.origin}/session/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Session URL copied to clipboard!");
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const handleLeave = async () => {
    if (!currentSession || !player) return;

    setIsLeaving(true);
    try {
      await leaveSession();
      toast.success("Left session");
      navigate("/activity");
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
    setShowAddForm(false);
    // Refresh matches after creating a new one
    if (code) {
      const matches = await getMatchesForSession(code);
      setSessionMatches(matches);
    }
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
      <div className="page-header">
        <div className="page-header-top">
          <Button variant="outline" onClick={() => navigate(-1)} size="icon">
            <ChevronLeft />
          </Button>
          <div className="header-actions">
            <Button variant="outline" onClick={handleCopyUrl}>
              Copy URL
            </Button>
            <Button variant="outline" onClick={handleLeave} disabled={isLeaving}>
              {isLeaving ? "Leaving..." : "Leave Session"}
            </Button>
          </div>
        </div>
        <h1>Session {code}</h1>
      </div>

      <div className="session-content">
        <section className="participants-section">
          <h2>Players ({sessionParticipants.length})</h2>
          {playersLoading ? (
            <div className="loading">Loading participants...</div>
          ) : sessionParticipants.length === 0 ? (
            <div className="empty-state">No participants yet</div>
          ) : (
            <div className="participants-grid">
              {sessionParticipants.map((participant) => (
                <PlayerCard key={participant.id} player={participant} />
              ))}
            </div>
          )}
        </section>

        <section className="matches-section">
          <div className="matches-section-header">
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
          className="new-match-button-mobile"
          size="lg"
        >
          + New Match
        </Button>
      )}

      <AddMatchForm
        open={showAddForm}
        onOpenChange={setShowAddForm}
        onSubmit={handleSubmitMatch}
        defaultGameId={currentSession.gameID}
        sessionParticipants={sessionParticipants}
        sessionCode={code}
      />
    </div>
  );
}
