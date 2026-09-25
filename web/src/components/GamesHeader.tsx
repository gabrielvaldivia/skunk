import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ActivityIcon, CloseIcon, PlusIcon, SearchIcon } from "./icons";
import { cn } from "@/lib/utils";
import { Glass } from "./Glass";
import type { GameScope } from "../hooks/useGameScope";



interface GamesHeaderProps {
  scope: GameScope;
  onScopeChange: (scope: GameScope) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Fades the header out, e.g. while a game is open on the shelf */
  hidden?: boolean;
  onAdd: () => void;
  /** Open Activity in place (desktop panel); otherwise the button links to the page */
  onActivity?: () => void;
  /** Floats bottom-middle, e.g. your live session: between Activity and search on phones, above search on desktop */
  bottomCenter?: React.ReactNode;
}

const SCOPES: { value: GameScope; label: string }[] = [
  { value: "mine", label: "My Games" },
  { value: "all", label: "All Games" },
];

// Floating chrome for the Games home. Account (pinned by Layout) top-left,
// My Games / All Games top-middle, Add top-right. Desktop: Activity beside
// Add, search bottom-middle. Phones: Activity bottom-left and search
// bottom-right, which grows across the bottom when focused.
export function GamesHeader({ scope, onScopeChange, query, onQueryChange, hidden, onAdd, onActivity, bottomCenter }: GamesHeaderProps) {
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const open = focused || query !== "";
  // Round glass buttons: the wrapper positions, the glass fills it
  const iconButton =
    "flex size-full items-center justify-center rounded-full transition-transform active:scale-95";

  return (
    <header
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-40 h-[calc(var(--safe-top)+0.75rem+3rem)] transition-opacity duration-300",
        hidden && "opacity-0"
      )}
      aria-hidden={hidden || undefined}
    >
      {/* Centred on the screen when there's room; on phones, centred in the gap
          between the account button and the add + search buttons */}
      <div
        className={cn(
          "absolute inset-x-[calc(var(--page-gutter)+3.5rem)] top-[calc(var(--safe-top)+0.75rem)] flex justify-center md:inset-x-0"
        )}
      >
        <Glass
          role="tablist"
          aria-label="Which games"
          className={cn("flex h-12 items-center p-1", !hidden && "pointer-events-auto")}
        >
          {SCOPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              onClick={() => onScopeChange(value)}
              tabIndex={hidden ? -1 : undefined}
              className={cn(
                "h-10 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition-colors max-[389px]:px-2",
                scope === value ? "bg-foreground text-background [text-shadow:none]" : "text-white/90 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </Glass>
      </div>

      <div
        className={cn(
          "fixed bottom-[calc(var(--safe-bottom)+1.25rem)] left-[var(--page-gutter)] size-12 transition-opacity md:absolute md:bottom-auto md:left-auto md:right-[calc(var(--page-gutter)+3.5rem)] md:top-[calc(var(--safe-top)+0.75rem)]",
          !hidden && "pointer-events-auto",
          // On phones the open search field takes the whole bottom row
          open && "max-md:pointer-events-none max-md:opacity-0"
        )}
      >
        <Glass className="size-full">
          {onActivity ? (
            <button type="button" onClick={onActivity} aria-label="Activity" tabIndex={hidden ? -1 : undefined} className={iconButton}>
              <ActivityIcon className="size-5" />
            </button>
          ) : (
            <Link to="/activity" aria-label="Activity" tabIndex={hidden ? -1 : undefined} className={iconButton}>
              <ActivityIcon className="size-5" />
            </Link>
          )}
        </Glass>
      </div>
      <div
        className={cn(
          "absolute right-[var(--page-gutter)] top-[calc(var(--safe-top)+0.75rem)] size-12",
          !hidden && "pointer-events-auto"
        )}
      >
        <Glass className="size-full">
          <button type="button" onClick={onAdd} aria-label="Add game" tabIndex={hidden ? -1 : undefined} className={iconButton}>
            <PlusIcon className="size-5" />
          </button>
        </Glass>
      </div>

      {bottomCenter && (
        <div
          className={cn(
            "transition-opacity duration-200",
            !hidden && "pointer-events-auto",
            // The open search field takes the bottom row on phones
            open && "max-md:pointer-events-none max-md:opacity-0"
          )}
        >
          {bottomCenter}
        </div>
      )}

      {/* Phones: a round button bottom-right that grows leftward to full width.
          Desktop: a small "Search" pill bottom-middle that grows when focused */}
      <div
        className={cn(
          "fixed bottom-[calc(var(--safe-bottom)+1.25rem+var(--kb,0px))] right-[var(--page-gutter)] h-12 transition-[width] duration-300 ease-out md:left-1/2 md:right-auto md:-translate-x-1/2",
          open
            ? "w-[calc(100%-2*var(--page-gutter))] md:w-[min(28rem,calc(100%-2*var(--page-gutter)))]"
            : "w-12 md:w-[8.5rem]",
          !hidden && "pointer-events-auto"
        )}
      >
        <Glass className="size-full">
          <label className="flex size-full cursor-text items-center overflow-hidden rounded-full">
        <span className="flex size-12 shrink-0 items-center justify-center" aria-hidden>
          <SearchIcon className="size-[18px]" />
        </span>
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onQueryChange("");
              e.currentTarget.blur();
            }
          }}
          placeholder="Search"
          aria-label="Search games"
          tabIndex={hidden ? -1 : undefined}
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent pr-2 text-base text-white outline-none placeholder:text-white/80 [&::-webkit-search-cancel-button]:hidden",
            // Collapsed on phones it's just the icon
            !open && "max-md:opacity-0"
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onQueryChange("");
              input.current?.focus();
            }}
            aria-label="Clear search"
            className="mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-white/90 hover:bg-white/15 hover:text-white"
          >
            <CloseIcon className="size-4" />
          </button>
        )}
          </label>
        </Glass>
      </div>
    </header>
  );
}
