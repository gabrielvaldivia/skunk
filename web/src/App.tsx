import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SessionProvider } from "./context/SessionContext";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";
import { Layout } from "./components/Layout";
import { SignInView } from "./components/SignInView";
import { OnboardingPage } from "./pages/OnboardingPage";
import { GamesPage } from "./pages/GamesPage";
import { GameDetailPage } from "./pages/GameDetailPage";
import { PlayersPage } from "./pages/PlayersPage";
import { PlayerDetailPage } from "./pages/PlayerDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ActivityPage } from "./pages/ActivityPage";
import { SessionPage } from "./pages/SessionPage";
import "./App.css";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, needsOnboarding, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

const ADMIN_EMAIL = "valdivia.gabriel@gmail.com";

function AppRoutes() {
  const { isLoading, isAuthenticated, needsOnboarding, user } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <Routes>
      <Route path="/signin" element={<SignInView />} />
      <Route
        path="/onboarding"
        element={
          isAuthenticated && (needsOnboarding || isAdmin) ? (
            <OnboardingPage />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/games"
        element={
          <ProtectedRoute>
            <Layout>
              <GamesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/games/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <GameDetailPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/players"
        element={
          <ProtectedRoute>
            <Layout>
              <PlayersPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/players/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <PlayerDetailPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/matches"
        element={
          <ProtectedRoute>
            <Layout>
              <ActivityPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:code"
        element={
          <ProtectedRoute>
            <Layout>
              <SessionPage />
            </Layout>
          </ProtectedRoute>
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
        <SessionProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SessionProvider>
      </AuthProvider>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
