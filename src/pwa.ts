// Web-only install support: the service worker that makes the game work
// offline, and the browser's "install this app" prompt.
//
// None of it runs inside the native iOS/Android apps, which already ship
// every file in their bundle and are already installed.

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "word-climb-install-dismissed";
const ASK_AGAIN_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

const isNative = Capacitor.isNativePlatform();

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// iPadOS reports itself as a Mac, so a Mac with a touchscreen is an iPad.
function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return at > 0 && Date.now() - at < ASK_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

// The browser fires beforeinstallprompt once, possibly before React has
// mounted, so it's caught here at module load and handed to the hook.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function initPwa() {
  if (isNative || !("serviceWorker" in navigator)) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our own button instead of the mini-infobar
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
  if (import.meta.env.PROD) {
    void import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
  }
}

export type InstallOffer =
  | { kind: "none" }
  | { kind: "prompt"; install: () => void; dismiss: () => void } // Chrome, Edge, Android
  | { kind: "ios"; dismiss: () => void }; // Safari has no prompt API: explain Share → Add to Home Screen

export function useInstallOffer(): InstallOffer {
  const [, rerender] = useState(0);
  const [dismissed, setDismissed] = useState(recentlyDismissed);

  useEffect(() => {
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  if (isNative || dismissed || isInstalled()) return { kind: "none" };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // private mode: it just asks again next visit
    }
    setDismissed(true);
  };

  if (deferredPrompt) {
    const promptEvent = deferredPrompt;
    return {
      kind: "prompt",
      dismiss,
      install: () => {
        void promptEvent.prompt();
        void promptEvent.userChoice.then(({ outcome }) => {
          deferredPrompt = null; // a prompt event can only be used once
          if (outcome === "dismissed") dismiss();
          else notify();
        });
      },
    };
  }

  if (isIOS()) return { kind: "ios", dismiss };
  return { kind: "none" };
}
