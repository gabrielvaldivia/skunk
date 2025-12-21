import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, signOut, signIn } = useAuth();

  const navItems = [
    { path: '/activity', label: 'Activity', icon: '📋' },
    { path: '/games', label: 'Games', icon: '🎮' },
    { path: '/players', label: 'Players', icon: '👥' },
  ];

  const handleAuthClick = async () => {
    if (isAuthenticated) {
      await signOut();
    } else {
      navigate('/signin');
    }
  };

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-content">
          <h1 className="nav-title">Skunk</h1>
          <div className="nav-links">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </div>
          <button onClick={handleAuthClick} className={isAuthenticated ? "sign-out-btn" : "sign-in-btn"}>
            {isAuthenticated ? 'Sign Out' : 'Sign In'}
          </button>
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

