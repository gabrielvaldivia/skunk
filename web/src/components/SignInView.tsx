import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SignInView.css';

export function SignInView() {
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/activity');
    }
  }, [isAuthenticated, navigate]);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signIn();
      navigate('/activity');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sign-in-container">
      <div className="sign-in-card">
        <h1>Skunk</h1>
        <p>Sign in to create and edit games, players, and matches</p>
        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="google-sign-in-btn"
        >
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>
        {error && <p className="error-message">{error}</p>}
        <p className="sign-in-hint">You can browse without signing in</p>
      </div>
    </div>
  );
}

