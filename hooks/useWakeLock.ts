"use client";

import { useEffect, useRef } from "react";

export function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    async function acquire() {
      try {
        lockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        // Wake Lock may be denied if the page is not visible — silently ignore
      }
    }

    async function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        await acquire();
      }
    }

    acquire();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, []);
}
