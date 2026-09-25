import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SessionProvider } from "./context/SessionContext";
import { DataCacheProvider } from "./context/DataCacheContext";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";
import { Layout } from "./components/Layout";
import { PanelProvider } from "./context/PanelContext";
import { PanelHost } from "./components/PanelHost";
import { SignInView } from "./components/SignInView";
import "./App.css";
import { isAdminEmail } from "@/lib/admin";

// Route-level code splitting so the first load doesn't pull in every page
const OnboardingPage = lazy(() => import("./pages/OnboardingPage").then((m) => ({ default: m.OnboardingPage })));
const GamesPage = lazy(() => import("./pages/GamesPage").then((m) => ({ default: m.GamesPage })));
const ShelfPage = lazy(() => import("./pages/ShelfPage").then((m) => ({ default: m.ShelfPage })));
const GameDetailPage = lazy(() => import("./pages/GameDetailPage").then((m) => ({ default: m.GameDetailPage })));
const PlayersPage = lazy(() => import("./pages/PlayersPage").then((m) => ({ default: m.PlayersPage })));
const PlayerDetailPage = lazy(() => import("./pages/PlayerDetailPage").then((m) => ({ default: m.PlayerDetailPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const ActivityPage = lazy(() => import("./pages/ActivityPage").then((m) => ({ default: m.ActivityPage })));
const SessionPage = lazy(() => import("./pages/SessionPage").then((m) => ({ default: m.SessionPage })));
const SessionsListPage = lazy(() => import("./pages/SessionsListPage").then((m) => ({ default: m.SessionsListPage })));

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

function AppRoutes() {
  const { isLoading, isAuthenticated, needsOnboarding, user } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  const isAdmin = isAdminEmail(user?.email);

  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
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
            <ShelfPage />
          </Layout>
        }
      />
      <Route
        path="/games/list"
        element={
          <Layout>
            <GamesPage />
          </Layout>
        }
      />
      <Route path="/games/shelf" element={<Navigate to="/games" replace />} />
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
      <Route path="/" element={<Navigate to="/games" replace />} />
    </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="skunk-ui-theme">
      <AuthProvider>
        <DataCacheProvider>
          <SessionProvider>
            <BrowserRouter>
              <PanelProvider>
                <AppRoutes />
                <PanelHost />
              </PanelProvider>
            </BrowserRouter>
          </SessionProvider>
        </DataCacheProvider>
      </AuthProvider>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
