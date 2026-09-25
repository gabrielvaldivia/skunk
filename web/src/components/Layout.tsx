import { useLocation } from "react-router-dom";
import { AccountButton } from "./AccountButton";
import { usePanel } from "../context/PanelContext";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

// The Games tab (shelf or list) is home; everything else is reached from it
const HOME_PATHS = ["/games", "/games/list"];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isHome = HOME_PATHS.includes(location.pathname);
  // On desktop, your account opens in the side panel over the page
  const panel = usePanel();

  return (
    <div className={cn("min-h-dvh bg-background", isHome && "has-account")}>
      <main
        className="mx-auto w-full max-w-[var(--page-max-width)] px-[var(--page-gutter)]"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 6rem)" }}
      >
        {children}
      </main>
      {isHome && (
        // Pinned to the screen corner; page headers leave room for it
        <div className="chrome-fade fixed left-[var(--page-gutter)] top-[calc(var(--safe-top)+0.75rem)] z-50">
          <AccountButton size={48} variant="pill" onOpen={panel ? () => panel.open({ type: "profile" }) : undefined} />
        </div>
      )}
    </div>
  );
}
