import { useState, useEffect } from "react";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // App installed successfully
    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    // Check if already in standalone mode (already installed)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  // Don't show if already installed
  if (installed) return null;

  // iOS - show instructions
  if (isIOS && !installed) {
    return (
      <button
        onClick={() => alert('En iOS: abre el menú Compartir (icono cuadrado con flecha) y selecciona "Agregar a Pantalla de Inicio".')}
        className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-surface-2 border border-border hover:bg-surface-3 transition"
        title="Instalar app"
      >
        <Download className="h-3.5 w-3.5 text-accent" />
        <span className="hidden sm:inline">Instalar</span>
      </button>
    );
  }

  // Android/Desktop - show install button
  if (deferredPrompt) {
    return (
      <button
        onClick={handleInstall}
        className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-accent text-white hover:bg-accent-hover transition"
        title="Instalar app en tu dispositivo"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Instalar</span>
      </button>
    );
  }

  return null;
}
