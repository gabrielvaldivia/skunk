import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SessionProvider } from "./context/SessionContext";
import { DataCacheProvider } from "./context/DataCacheContext";
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
import { SessionsListPage } from "./pages/SessionsListPage";
import "./App.css";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, needsOnboarding, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    // Preserve the intended destination so we can redirect back after sign-in
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (needsOnboarding) {
    // Preserve the intended destination through onboarding
    return <Navigate to="/onboarding" state={{ from: location }} replace />;
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
        path="/players"
        element={
          <Layout>
            <PlayersPage />
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
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
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
      <Route
        path="/sessions"
        element={
          <ProtectedRoute>
            <Layout>
              <SessionsListPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="/matches" element={<Navigate to="/activity" replace />} />
      <Route path="/" element={<Navigate to="/activity" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="skunk-ui-theme">
      <AuthProvider>
        <DataCacheProvider>
          <SessionProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </SessionProvider>
        </DataCacheProvider>
      </AuthProvider>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
