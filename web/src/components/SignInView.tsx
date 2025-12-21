import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import "./SignInView.css";

const ADMIN_EMAIL = "valdivia.gabriel@gmail.com";

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
  const isAdmin = user?.email === ADMIN_EMAIL;

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
      navigate("/profile");
    } else {
      navigate(from || "/");
    }
  };

  return (
    <div className="sign-in-container">
      <button className="sign-in-close-button" onClick={handleClose}>
        <X size={20} />
      </button>
      <div className="sign-in-card">
        <h1>Skunk</h1>
        <p>Sign in to create and edit games, players, and matches</p>
        <Button onClick={handleSignIn} disabled={isLoading} size="lg">
          {isLoading ? "Signing in..." : "Sign in with Google"}
        </Button>
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}
