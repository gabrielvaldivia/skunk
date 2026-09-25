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
