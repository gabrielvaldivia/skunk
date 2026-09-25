import { useId, useMemo, useRef, useState } from "react";
import type { Game } from "../models/Game";
import { GameDetailPage } from "../pages/GameDetailPage";
import { ChevronDownIcon } from "./icons";
import { cn } from "@/lib/utils";

const LAST_PICK_KEY = "skunk.lastCardGame";

function readLastPick() {
  try {
    return localStorage.getItem(LAST_PICK_KEY);
  } catch {
    return null;
  }
}

function saveLastPick(id: string) {
  try {
    localStorage.setItem(LAST_PICK_KEY, id);
  } catch {
    // Storage unavailable (private mode); the default just won't stick
  }
}

interface CardGamePickerProps {
  /** Card games in the deck, already narrowed by any shelf search */
  games: Game[];
  onClose: () => void;
}

// Detail view for the shelf's deck of cards: pick a card game, see its page.
// Opens on the game you picked last time.
export function CardGamePicker({ games, onClose }: CardGamePickerProps) {
  const [chosenId, setChosenId] = useState(() => readLastPick());
  // The last pick may not be in this (searched) deck; fall back to the first
  const chosen = games.find((g) => g.id === chosenId) ?? games[0];
  if (!chosen) return null;

  const choose = (id: string) => {
    setChosenId(id);
    saveLastPick(id);
  };

  return (
    <GameDetailPage
      key={chosen.id}
      gameId={chosen.id}
      onClose={onClose}
      navTitle={<GameCombobox games={games} value={chosen} onChange={choose} />}
    />
  );
}

// Phones: the field sits low, under the 3D box, where the keyboard covers the
// list. Scroll the sheet so the field sits at the top, just under the corner
// buttons, with the results below it. Short pages get room added to scroll into.
function liftToTop(field: HTMLElement) {
  if (window.matchMedia("(min-width: 768px)").matches) return;
  const scroller = field.closest<HTMLElement>(".overflow-y-auto");
  if (!scroller) return;
  // Where the field should land: below the close/heart buttons in the corners
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:calc(var(--safe-top, env(safe-area-inset-top)) + 4.25rem)";
  document.body.appendChild(probe);
  const target = probe.getBoundingClientRect().top;
  probe.remove();
  scroller.style.paddingBottom = `${window.innerHeight}px`;
  const by = field.getBoundingClientRect().top - target;
  scroller.scrollTo({ top: scroller.scrollTop + by, behavior: "smooth" });
}

function settle(field: HTMLElement | null) {
  const scroller = field?.closest<HTMLElement>(".overflow-y-auto");
  if (scroller) scroller.style.paddingBottom = "";
}

// Type to filter, arrows to move, Enter to pick, Escape to back out
function GameCombobox({ games, value, onChange }: { games: Game[]; value: Game; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const options = useMemo(() => {
    const q = text.trim().toLowerCase();
    return q ? games.filter((g) => g.title.toLowerCase().includes(q)) : games;
  }, [games, text]);

  const openList = () => {
    if (input.current) liftToTop(input.current);
    setOpen(true);
    setText("");
    setActive(Math.max(0, games.findIndex((g) => g.id === value.id)));
  };
  const pick = (game: Game) => {
    onChange(game.id);
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="relative w-full text-left">
      <input
        ref={input}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[active] ? `${listId}-${options[active].id}` : undefined}
        aria-label="Card game"
        value={open ? text : value.title}
        placeholder={value.title}
        onFocus={openList}
        onBlur={() => {
          setOpen(false);
          settle(input.current);
        }}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(options.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && options[active]) {
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Escape") {
            // Close the list, not the whole panel
            e.stopPropagation();
            setOpen(false);
            e.currentTarget.blur();
          }
        }}
        className="h-11 w-full rounded-full bg-secondary pl-4 pr-10 text-base font-semibold text-secondary-foreground outline-none placeholder:text-muted-foreground"
      />
      <ChevronDownIcon
        className={cn(
          "pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-transform",
          open && "rotate-180"
        )}
        aria-hidden
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-border/60 bg-popover p-1 text-sm shadow-[0_16px_48px_-16px_rgb(0_0_0/0.35)]"
        >
          {options.length === 0 && <li className="px-3 py-2.5 text-muted-foreground">No card games match</li>}
          {options.map((g, i) => (
            <li
              key={g.id}
              id={`${listId}-${g.id}`}
              role="option"
              aria-selected={g.id === value.id}
              // mousedown, not click: fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                pick(g);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "cursor-pointer truncate rounded-xl px-3 py-2.5",
                i === active && "bg-muted",
                g.id === value.id && "font-semibold"
              )}
            >
              {g.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
