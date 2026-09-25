import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "./icons";
import "./SignInView.css";
import { isAdminEmail } from "@/lib/admin";

export function SignInView() {
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

  useEffect(() => {
    // Don't redirect if admin is viewing the sign-in screen intentionally
    if (isAuthenticated && !(isAdminView && isAdmin)) {
      // Redirect to the intended destination (or home)
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from, isAdminView, isAdmin]);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signIn();
      // Navigate to intended destination or default to home
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isAdminView && isAdmin) {
      navigate("/profile", { replace: true });
    } else {
      navigate(from || "/", { replace: true });
    }
  };

  return (
    <div className="sign-in-container">
      <button className="sign-in-close-button" onClick={handleClose} aria-label="Close">
        <CloseIcon size={18} />
      </button>
      <div className="sign-in-content">
        <div className="sign-in-mark" aria-hidden>🦨</div>
        <h1>Skunk</h1>
        <p>Track every game night. Sign in to log matches, games and players.</p>
        <div className="sign-in-actions">
          <Button onClick={handleSignIn} disabled={isLoading} size="lg" className="w-full">
            {isLoading ? "Signing in..." : "Continue with Google"}
          </Button>
          {error && <p className="error-message">{error}</p>}
        </div>
      </div>
    </div>
  );
}
