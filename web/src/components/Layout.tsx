import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, signOut } = useAuth();

  const navItems = [
    { path: "/matches", label: "Activity", icon: "📋" },
    { path: "/games", label: "Games", icon: "🎮" },
    { path: "/profile", label: "Profile", icon: "👤" },
  ];

  const handleAuthClick = async () => {
    if (isAuthenticated) {
      await signOut();
    } else {
      navigate("/signin");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-7xl items-center px-4">
          <div className="mr-4 flex">
            <Link to="/" className="mr-6 flex items-center space-x-2">
              <h1 className="text-xl font-bold">Skunk</h1>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "transition-colors hover:text-foreground/80",
                    location.pathname === item.path
                      ? "text-foreground"
                      : "text-foreground/60"
                  )}
                >
                  <span className="mr-1">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <ThemeToggle />
            <Button
              onClick={handleAuthClick}
              variant={isAuthenticated ? "outline" : "default"}
            >
              {isAuthenticated ? "Sign Out" : "Sign In"}
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
