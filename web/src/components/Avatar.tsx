import type { Player } from "../models/Player";
import { cn } from "@/lib/utils";
import { getPlayerColor, getInitials } from "@/lib/player";

interface AvatarProps {
  player: Pick<Player, "name" | "photoData" | "colorData">;
  size?: number;
  className?: string;
}

export function Avatar({ player, size = 40, className }: AvatarProps) {
  return (
    <span
      className={cn("avatar", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        backgroundColor: player.photoData ? undefined : getPlayerColor(player),
      }}
    >
      {player.photoData ? (
        <img src={`data:image/jpeg;base64,${player.photoData}`} alt={player.name} />
      ) : (
        getInitials(player.name)
      )}
    </span>
  );
}
