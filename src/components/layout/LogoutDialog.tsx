import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WordRotate } from "@/components/ui/magicui/word-rotate";
import { PulsatingButton } from "@/components/ui/magicui/pulsating-button";
import { useAuthStore } from "@/stores/authStore";

const NAGGING_TITLES = [
  "Are you sure?",
  "Don't leave us!",
  "Wait a sec…",
  "Really, though?",
];

interface LogoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogoutDialog({ open, onOpenChange }: LogoutDialogProps) {
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden rounded-md border border-border/60 bg-card/80 p-5 text-foreground shadow-2xl shadow-black/40 backdrop-blur-md sm:max-w-md"
      >
        <DialogHeader className="items-center text-center">
          <div className="mx-auto h-28 w-28">
            <DotLottieReact src="/mascot.lottie" loop autoplay />
          </div>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            <WordRotate words={NAGGING_TITLES} duration={2200} />
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Your goals will miss you. Logging out ends your session — anything
            unsaved stays on this device.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {signingOut ? "Logging out…" : "Logout"}
          </Button>
          <PulsatingButton
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={signingOut}
          >
            Stay
          </PulsatingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
