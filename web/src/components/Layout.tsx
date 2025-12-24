import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: "/activity", label: "Activity", icon: "📋" },
    { path: "/sessions", label: "Sessions", icon: "🎯" },
    { path: "/games", label: "Games", icon: "🎮" },
    { path: "/players", label: "Players", icon: "👥" },
    { path: "/profile", label: "Account", icon: "👤" },
  ];

  return (
    <div className="min-h-screen bg-background pb-16">
      <main className="container mx-auto max-w-7xl px-4 py-6">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
