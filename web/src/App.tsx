import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./components/theme-provider";
import { Layout } from "./components/Layout";
import { SignInView } from "./components/SignInView";
import { GamesPage } from "./pages/GamesPage";
import { GameDetailPage } from "./pages/GameDetailPage";
import { PlayerDetailPage } from "./pages/PlayerDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ActivityPage } from "./pages/ActivityPage";
import "./App.css";

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
        path="/games/:id"
        element={
          <Layout>
            <GameDetailPage />
          </Layout>
        }
      />
      <Route
        path="/players/:id"
        element={
          <Layout>
            <PlayerDetailPage />
          </Layout>
        }
      />
      <Route
        path="/profile"
        element={
          <Layout>
            <ProfilePage />
          </Layout>
        }
      />
      <Route
        path="/matches"
        element={
          <Layout>
            <ActivityPage />
          </Layout>
        }
      />
      <Route path="/activity" element={<Navigate to="/matches" replace />} />
      <Route path="/" element={<Navigate to="/matches" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="skunk-ui-theme">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
