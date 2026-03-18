import { useEffect, useState, useCallback } from "react";

// ============================================
// CHANGELOG - Dodaj nove verzije ovdje na vrh
// ============================================
const RELEASES = [
  {
    version: "1.0.11",
    date: "2025-12-16",
    changes: ["Korekcije u dizajnu."],
  },
];

// Trenutna verzija je uvijek prva u nizu (najnovija)
const CURRENT_VERSION = RELEASES[0].version;

export function PWAUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  // Check if running as installed PWA
  const isInstalledPWA = () => {
    return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
  };

  const applyUpdate = useCallback((worker: ServiceWorker) => {
    worker.postMessage({ type: "SKIP_WAITING" });
  }, []);

  useEffect(() => {
    // Sačuvaj verziju
    localStorage.setItem("app-version", CURRENT_VERSION);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Check for updates on load
        registration.update();

        // Listen for new service worker waiting
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // Tiho ažuriraj bez pitanja
                setWaitingWorker(newWorker);
                applyUpdate(newWorker);
              }
            });
          }
        });

        // Check if there's already a waiting worker - tiho ažuriraj
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          applyUpdate(registration.waiting);
        }
      });

      // Handle controller change (when new SW takes over)
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;

          // If installed PWA, try to close and reopen
          if (isInstalledPWA()) {
            sessionStorage.setItem("pwa-just-updated", "true");
            const currentUrl = window.location.href;
            setTimeout(() => {
              window.location.href = currentUrl;
            }, 500);
          } else {
            // For browser: just reload
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        }
      });
    }

    // Listen for manual refresh trigger
    const handleManualRefresh = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.update();

          if (registration.waiting) {
            applyUpdate(registration.waiting);
          }
        } catch (error) {
          console.log("Update check failed:", error);
        }
      }
    };

    window.addEventListener("pwa-check-update", handleManualRefresh);

    return () => {
      window.removeEventListener("pwa-check-update", handleManualRefresh);
    };
  }, [applyUpdate]);

  // Ne renderuj ništa - tiho ažuriranje
  return null;
}

// Export function to trigger update check
export const triggerUpdateCheck = () => {
  window.dispatchEvent(new CustomEvent("pwa-check-update"));
};

// Export current version for use elsewhere
export const getCurrentVersion = () => CURRENT_VERSION;

// Export all releases for version history page if needed
export const getAllReleases = () => RELEASES;
