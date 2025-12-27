import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useDataCache } from "../context/DataCacheContext";
import "./MiniSessionSheet.css";

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

export function MiniSessionSheet() {
  const navigate = useNavigate();
  const { currentSession } = useSession();
  const { players } = useDataCache();
  const [isPressing, setIsPressing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!isPressing) {
      setDragOffset(0);
    }
  }, [isPressing]);

  if (!currentSession) return null;

  const participantList = currentSession.participantIDs
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const createdLabel = formatRelativeTime(currentSession.createdAt);

  const navigateToSession = () => {
    navigate(`/session/${currentSession.code}`);
  };

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    setIsPressing(true);
    startYRef.current = e.touches[0].clientY;
  };

  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (!isPressing || startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    // We only care about upward movement (negative delta)
    setDragOffset(delta < 0 ? Math.max(-80, delta) : 0);
  };

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    const shouldOpen = dragOffset <= -40; // swiped up at least 40px
    setIsPressing(false);
    startYRef.current = null;
    setDragOffset(0);
    if (shouldOpen) {
      navigateToSession();
    }
  };

  const onClick: React.MouseEventHandler<HTMLDivElement> = () => {
    navigateToSession();
  };

  return (
    <div
      className="mini-session-sheet"
      style={{
        transform:
          dragOffset !== 0
            ? `translateX(-50%) translateY(${dragOffset}px)`
            : undefined,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      role="button"
      aria-label="Open active session"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigateToSession();
        }
      }}
    >
      <div className="mini-session-handle" aria-hidden />
      <div className="mini-session-content">
        <div className="mini-session-title">Session {currentSession.code}</div>
        <div className="mini-session-created">Created {createdLabel}</div>
      </div>
      <div className="mini-session-facepile" aria-label="Participants">
        {participantList.slice(0, 5).map((p, idx) =>
          p.photoData ? (
            <img
              key={p.id}
              className={`facepile-avatar ${idx > 0 ? "overlap" : ""}`}
              src={`data:image/jpeg;base64,${p.photoData}`}
              alt={p.name}
            />
          ) : (
            <span
              key={p.id}
              className={`facepile-avatar initials ${idx > 0 ? "overlap" : ""}`}
            >
              {p.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </span>
          )
        )}
        {participantList.length > 5 && (
          <span className="facepile-more overlap">+{participantList.length - 5}</span>
        )}
      </div>
    </div>
  );
}

