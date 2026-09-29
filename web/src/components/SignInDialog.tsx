import { useState } from "react";
import { setSignInOpen as setOpen, useSignInOpen } from "@/lib/signInPrompt";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SignInContent } from "./SignInView";
import "./SignInView.css";

export function SignInDialog() {
  const isOpen = useSignInOpen();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signIn();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogContent className="max-w-sm px-6 pb-8 pt-12">
        <DialogTitle className="sr-only">Sign in to Skunk</DialogTitle>
        <DialogDescription className="sr-only">Sign in to log matches, games and players.</DialogDescription>
        <SignInContent onSignIn={handleSignIn} isLoading={isLoading} error={error} />
      </DialogContent>
    </Dialog>
  );
}
