import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CloseIcon } from "./icons";
import "./SignInView.css";
import { isAdminEmail } from "@/lib/admin";

/**
 * onDone: shown in the desktop panel, which it closes once you're signed in (instead of navigating).
 * preview: the admin looking at what a signed-out visitor sees; nothing signs in or redirects.
 */
export function SignInView({ onDone, preview: previewProp = false }: { onDone?: () => void; preview?: boolean } = {}) {
  const { signIn, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the intended destination from location state, or default to home
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  // Check if this is an admin viewing the sign-in screen intentionally
  const searchParams = new URLSearchParams(location.search);
  const isAdminView = searchParams.get("admin") === "true";
  const isAdmin = isAdminEmail(user?.email);
  const preview = isAdmin && (previewProp || isAdminView);

  useEffect(() => {
    // Don't redirect if admin is viewing the sign-in screen intentionally
    if (isAuthenticated && !preview) {
      // Redirect to the intended destination (or home)
      if (onDone) onDone();
      else navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from, preview, onDone]);

  const handleSignIn = async () => {
    if (preview) {
      toast("Preview: this is what signed-out visitors see");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await signIn();
      // Navigate to intended destination or default to home
      if (onDone) onDone();
      else navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (onDone) {
      onDone();
    } else if (preview) {
      navigate("/profile", { replace: true });
    } else {
      navigate(from || "/", { replace: true });
    }
  };

  return (
    <div className={`sign-in-container${onDone ? " in-panel" : ""}`}>
      {/* In the panel, pinned to the panel's corner (it's the containing block) */}
      <button className="sign-in-close-button" onClick={handleClose} aria-label="Close">
        <CloseIcon size={20} />
      </button>
      <div className="sign-in-content">
        <div className="sign-in-mark" aria-hidden><img src="/brand/logo.png" alt="" /></div>
        <h1>Skunk</h1>
        <p>Track every game night. Sign in to log matches, games and players.</p>
        <div className="sign-in-actions">
          <Button onClick={handleSignIn} disabled={isLoading} size="lg" className="w-full">
            {isLoading ? "Signing in..." : "Continue with Google"}
          </Button>
          {error && <p className="error-message">{error}</p>}
          <p className="sign-in-legal">
            By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
