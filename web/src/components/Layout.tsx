import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const navItems = [
    { path: "/activity", label: "Activity", icon: "📋" },
    { path: "/games", label: "Games", icon: "🎮" },
    { path: "/players", label: "Players", icon: "👥" },
    // Only show Account when signed in
    ...(isAuthenticated ? [{ path: "/profile", label: "Account", icon: "👤" }] : []),
  ];

  const isGameDetailPage =
    location.pathname.startsWith("/games/") && location.pathname !== "/games";
  const isSessionPage = location.pathname.startsWith("/session/");
  const isSessionsListPage = location.pathname === "/sessions";
  const shouldHideNavOnMobile =
    isGameDetailPage || isSessionPage || isSessionsListPage;
  const shouldHideNav = isGameDetailPage || isSessionPage || isSessionsListPage;

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        !shouldHideNavOnMobile && "pb-16",
        shouldHideNavOnMobile && "pb-0 md:pb-16"
      )}
    >
      <main
        className={cn(
          "container mx-auto max-w-7xl",
          !isGameDetailPage && "px-5 py-6"
        )}
      >
        {children}
      </main>
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          shouldHideNav && "hidden",
          shouldHideNavOnMobile && !shouldHideNav && "hidden md:block"
        )}
      >
        <div className="container mx-auto flex max-w-[600px] items-center justify-around px-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs transition-colors",
                location.pathname === item.path
                  ? "text-foreground"
                  : "text-foreground/60"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
