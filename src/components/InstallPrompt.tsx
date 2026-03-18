import { useEffect, useState } from "react";
import { X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const brandColor = "#013DC4";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPromptProps {
  isDataLoaded?: boolean;
}

export function InstallPrompt({ isDataLoaded = true }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isInstalled = () => {
    return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
  };

  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  };

  const wasDismissedRecently = () => {
    const dismissedAt = localStorage.getItem("install-prompt-dismissed");
    if (!dismissedAt) return false;
    const hoursSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60);
    return hoursSince < 24;
  };

  useEffect(() => {
    if (isInstalled() || wasDismissedRecently()) return;

    if (isIOS()) {
      if (isDataLoaded) {
        setTimeout(() => setShowIOSPrompt(true), 2000);
      }
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isDataLoaded]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSPrompt(false);
    localStorage.setItem("install-prompt-dismissed", Date.now().toString());
  };

  if (dismissed) return null;

  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[90] animate-fade-in">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${brandColor}15` }}
            >
              <Plus className="w-5 h-5" style={{ color: brandColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm">Instaliraj aplikaciju</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Dodaj na početni ekran za brži pristup</p>
            </div>
            <button onClick={handleDismiss} className="p-1 hover:bg-muted rounded-lg">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="flex-1 h-9 text-xs">
              Kasnije
            </Button>
            <Button
              size="sm"
              onClick={handleInstall}
              className="flex-1 h-9 text-xs text-white"
              style={{ backgroundColor: brandColor }}
            >
              Instaliraj
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[90] animate-fade-in">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${brandColor}15` }}
            >
              <Share className="w-5 h-5" style={{ color: brandColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm">Instaliraj aplikaciju</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Klikni <Share className="w-3 h-3 inline mx-0.5" /> pa "Add to Home Screen"
              </p>
            </div>
            <button onClick={handleDismiss} className="p-1 hover:bg-muted rounded-lg">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default InstallPrompt;
