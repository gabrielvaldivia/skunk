import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./Avatar";
import { AccountIcon } from "./icons";
import { cn } from "@/lib/utils";
import { Glass } from "./Glass";

interface AccountButtonProps {
  className?: string;
  size?: number;
  /** Floating glass pill, matching the Games header buttons */
  variant?: "default" | "pill";
  /** Open the account in place (desktop panel) instead of going to the page */
  onOpen?: () => void;
}

// Entry to your account: your photo when signed in, otherwise sign in
export function AccountButton({ className, size = 36, variant = "default", onOpen }: AccountButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, player, user } = useAuth();
  // Your uploaded profile photo, else your Google photo, else initials
  const googlePhoto = !player?.photoData ? user?.photoURL : null;
  const showsPhoto = isAuthenticated && (!!player || !!googlePhoto);

  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-transform duration-150 active:scale-95",
        !showsPhoto &&
          (variant === "pill"
            ? "text-foreground/80 hover:text-foreground"
            : "bg-secondary text-secondary-foreground"),
        variant === "pill" && showsPhoto && "shadow-[0_8px_32px_-8px_rgb(0_0_0/0.25)]",
        className
      )}
      onClick={() => {
        if (!isAuthenticated) navigate("/signin", { state: { from: location } });
        else if (onOpen) onOpen();
        else navigate("/profile");
      }}
      style={{ width: size, height: size }}
      aria-label={isAuthenticated ? "Account" : "Sign in"}
    >
      {!isAuthenticated && variant === "pill" ? (
        <Glass className="flex size-full items-center justify-center">
          <AccountIcon className="size-[18px]" />
        </Glass>
      ) : !isAuthenticated ? (
        <AccountIcon className="size-5" />
      ) : googlePhoto ? (
        <img src={googlePhoto} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : player ? (
        <Avatar player={player} size={size} />
      ) : (
        <AccountIcon className={variant === "pill" ? "size-[18px]" : "size-5"} />
      )}
    </button>
  );
}
