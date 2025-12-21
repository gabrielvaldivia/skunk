import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { SignInView } from './components/SignInView';
import { GamesPage } from './pages/GamesPage';
import { PlayersPage } from './pages/PlayersPage';
import { ActivityPage } from './pages/ActivityPage';
import './App.css';

function AppRoutes() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/signin" element={<SignInView />} />
      <Route
        path="/games"
        element={
          <Layout>
            <GamesPage />
          </Layout>
        }
      />
      <Route
        path="/players"
        element={
          <Layout>
            <PlayersPage />
          </Layout>
        }
      />
      <Route
        path="/activity"
        element={
          <Layout>
            <ActivityPage />
          </Layout>
        }
      />
      <Route path="/" element={<Navigate to="/activity" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
