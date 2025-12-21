import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import "./SignInView.css";

export function SignInView() {
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the intended destination from location state, or default to home
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  useEffect(() => {
    if (isAuthenticated) {
      // Redirect to the intended destination (or home)
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

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

  return (
    <div className="sign-in-container">
      <div className="sign-in-card">
        <h1>Skunk</h1>
        <p>Sign in to create and edit games, players, and matches</p>
        <Button onClick={handleSignIn} disabled={isLoading} size="lg">
          {isLoading ? "Signing in..." : "Sign in with Google"}
        </Button>
        {error && <p className="error-message">{error}</p>}
        <p className="sign-in-hint">You can browse without signing in</p>
      </div>
    </div>
  );
}
