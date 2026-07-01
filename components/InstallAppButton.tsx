"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

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

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setShowIosHelp(isIosDevice() && !isStandalone());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosHelp(false);
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

  async function installApp() {
    if (!installPrompt) {
      setShowIosHelp(isIosDevice());
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (installed) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl bg-[#1E3047] p-3 text-white">
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
        <p className="mt-2 text-xs leading-5 text-gray-200">
          Sur iPhone : ouvrez Safari, touchez Partager, puis
          Ajouter a l'ecran d'accueil.
        </p>
      )}
    </div>
  );
}
