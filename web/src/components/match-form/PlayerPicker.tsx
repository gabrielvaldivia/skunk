import { Input } from "@/components/ui/input";
import { getPlayerColor, getInitials, getPlayerPhotoSrc } from "@/lib/player";
import type { Player } from "../../models/Player";

interface PlayerPickerProps {
  index: number;
  value: string;
  player: Player | undefined; // Resolved player for `value`, if it matches one
  suggestions: Player[];
  showSuggestions: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: (value: string) => void;
  onSelect: (playerName: string) => void;
}

// Avatar + autocomplete input for choosing one player in the match form
export function PlayerPicker({
  index,
  value,
  player,
  suggestions,
  showSuggestions,
  onChange,
  onFocus,
  onBlur,
  onSelect,
}: PlayerPickerProps) {
  const photoSrc = getPlayerPhotoSrc(player);

  return (
    <>
      <div
        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-medium text-white shrink-0"
        style={player ? { backgroundColor: getPlayerColor(player) } : undefined}
      >
        {player && photoSrc ? (
          <img src={photoSrc} alt={player.name} className="w-full h-full object-cover" />
        ) : player ? (
          <span>{getInitials(player.name)}</span>
        ) : (
          <span className="text-muted-foreground">?</span>
        )}
      </div>
      <div className="flex-1 relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={(e) => onBlur(e.target.value)}
          placeholder={`Player ${index + 1}`}
          className="w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none bg-transparent px-0"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  // Prevent input blur when clicking suggestion
                  e.preventDefault();
                  onSelect(suggestion.name);
                }}
              >
                {suggestion.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
