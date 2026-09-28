// Fallback avatar color derived from the name hash (matches the iOS implementation)
export function getPlayerColor(player: { colorData?: string; name: string }): string {
  if (player.colorData) {
    return player.colorData;
  }
  const hash = player.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// "Brian Lovin" → "Brian L."; single names stay as they are
export function getShortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
