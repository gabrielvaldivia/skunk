import { useState, useRef, useEffect } from "react";
import type { Player } from "../models/Player";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PlayerAutocompleteProps {
  players: Player[];
  selectedPlayerId: string | null;
  onSelect: (playerId: string | null) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  excludePlayerIds?: string[];
}

export function PlayerAutocomplete({
  players,
  selectedPlayerId,
  onSelect,
  placeholder = "Search for a player...",
  label,
  disabled = false,
  excludePlayerIds = [],
}: PlayerAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPlayer = selectedPlayerId
    ? players.find((p) => p.id === selectedPlayerId)
    : null;

  // Filter players based on search term and exclude already selected players
  const availablePlayers = players.filter(
    (player) =>
      !excludePlayerIds.includes(player.id) &&
      player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset search term when player is cleared
  useEffect(() => {
    if (!selectedPlayerId) {
      // Player was cleared, reset search term and close dropdown
      setSearchTerm("");
      setIsOpen(false);
    } else if (selectedPlayer) {
      // Player is selected, clear search term to show player name
      setSearchTerm("");
    }
  }, [selectedPlayerId, selectedPlayer]);

  // Show dropdown when typing or when input is focused
  useEffect(() => {
    if (searchTerm.length > 0 || (inputRef.current === document.activeElement && !selectedPlayer)) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [searchTerm, selectedPlayer]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // If user clears the input, clear selection
    if (value === "") {
      onSelect(null);
    }
  };

  const handleSelect = (playerId: string) => {
    onSelect(playerId);
    const player = players.find((p) => p.id === playerId);
    setSearchTerm(player?.name || "");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setSearchTerm("");
    onSelect(null);
    inputRef.current?.focus();
  };

  const displayValue = selectedPlayer ? selectedPlayer.name : searchTerm;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <Label className="mb-2">
          {label}
        </Label>
      )}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (!selectedPlayer) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-8"
        />
        {selectedPlayer && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xl leading-none"
            tabIndex={-1}
          >
            ×
          </button>
        )}
      </div>
      {isOpen && availablePlayers.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="max-h-60 overflow-auto p-1">
            {availablePlayers.map((player) => (
              <div
                key={player.id}
                onClick={() => handleSelect(player.id)}
                className={cn(
                  "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer"
                )}
              >
                {player.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

