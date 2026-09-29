import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { reportContent, type Report } from "../services/databaseService";
import { isAdminEmail } from "@/lib/admin";

/** Quiet "Report" link for games and profiles; reports land in the admin's Review list */
export function ReportLink({ kind, targetId, label }: { kind: Report["kind"]; targetId: string; label: string }) {
  const { user } = useAuth();
  if (!user || isAdminEmail(user.email)) return null;

  const report = async () => {
    const reason = window.prompt(`What's wrong with ${label}? (optional)`);
    if (reason === null) return;
    try {
      await reportContent(kind, targetId, user.uid, reason.trim());
      toast.success("Thanks, we'll take a look.");
    } catch {
      toast.error("Couldn't send that report");
    }
  };

  return (
    <button type="button" className="report-link" onClick={report}>
      Report {kind === "game" ? "this game" : "this profile"}
    </button>
  );
}
