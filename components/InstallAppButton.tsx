"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isIosDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean })
      .standalone === true
  );
}

function getPlatform() {
  if (typeof window === "undefined") {
    return "unknown";
  }

  const userAgent = window.navigator.userAgent;

  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return "ios";
  }

  if (/android/i.test(userAgent)) {
    return "android";
  }

  return "desktop";
}

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = isStandalone();

    setInstalled(standalone);

    if (standalone) {
      trackInstallation("standalone");
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosHelp(false);
      trackInstallation("appinstalled");
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener(
        "appinstalled",
        handleInstalled
      );
    };
  }, []);

  async function trackInstallation(source: string) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        return;
      }

      await fetch("/api/app-installations/track", {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: getPlatform(),
          source,
        }),
      });
    } catch (error) {
      console.error("Installation tracking:", error);
    }
  }

  async function installApp() {
    if (!installPrompt) {
      setShowIosHelp(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      trackInstallation("accepted_prompt");
    }

    setInstallPrompt(null);
  }

  if (installed) {
    return null;
  }

  return (
    <div className="relative mt-3 rounded-xl bg-[#1E3047] p-3 text-white">
      <button
        type="button"
        onClick={installApp}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D8AA82] px-3 py-2 text-sm font-bold text-white hover:opacity-90"
      >
        {installPrompt ? (
          <Download size={16} />
        ) : (
          <Smartphone size={16} />
        )}
        Installer l'application
      </button>

      {showIosHelp && (
        <div className="fixed inset-x-3 bottom-4 z-[80] mx-auto max-w-sm rounded-2xl border border-[#D8AA82]/40 bg-[#1E3047] p-4 text-white shadow-2xl md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:right-0 md:top-full md:mt-2">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-[#D8AA82] p-2 text-[#1E3047]">
              <Share size={18} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#D8AA82]">
                Installer sur iPhone
              </p>
              <p className="mt-1 text-sm leading-5 text-gray-100">
                Ouvrez cette page dans Safari, touchez le bouton
                Partager, puis choisissez Ajouter a l'ecran
                d'accueil.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="rounded-lg bg-[#142238] p-2 text-white hover:bg-[#243854]"
              aria-label="Fermer l'aide d'installation"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
