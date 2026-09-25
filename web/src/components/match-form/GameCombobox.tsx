import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Game } from "../../models/Game";

interface GameComboboxProps {
  query: string;
  onQueryChange: (query: string) => void;
  suggestions: Game[];
  onSelect: (game: Game) => void;
}

// Searchable game picker with keyboard navigation
export function GameCombobox({ query, onQueryChange, suggestions, onSelect }: GameComboboxProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const select = (game: Game) => {
    onSelect(game);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <Input
        id="game"
        type="text"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setShowSuggestions(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => setShowSuggestions(false), 150);
        }}
        onKeyDown={(e) => {
          if (!showSuggestions) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          } else if (e.key === "Enter") {
            if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
              select(suggestions[highlightedIndex]);
              e.preventDefault();
            }
          } else if (e.key === "Escape") {
            setShowSuggestions(false);
          }
        }}
        placeholder="Search games…"
        className="w-full pr-9"
      />
      <button
        type="button"
        aria-label="Toggle game list"
        onMouseDown={(e) => {
          e.preventDefault();
          setShowSuggestions((prev) => !prev);
          setHighlightedIndex(-1);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
      >
        <ChevronsUpDown size={16} />
      </button>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((game, idx) => (
            <button
              key={game.id}
              type="button"
              className={`w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground ${idx === highlightedIndex ? "bg-accent text-accent-foreground" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                select(game);
              }}
            >
              {game.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
