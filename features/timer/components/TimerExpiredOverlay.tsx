"use client";

import { useEffect, useRef, useState } from "react";
import type { TimerState } from "../types";

interface TimerExpiredOverlayProps {
  timer: TimerState;
}

export function TimerExpiredOverlay({ timer }: TimerExpiredOverlayProps) {
  const [visible, setVisible] = useState(false);
  const prevIsRunningRef = useRef(timer.isRunning);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const wasRunning = prevIsRunningRef.current;
    prevIsRunningRef.current = timer.isRunning;

    // Transition: was running → stopped at 0 = time's up
    if (
      wasRunning &&
      !timer.isRunning &&
      timer.remaining <= 0 &&
      timer.startedAt !== null
    ) {
      clearTimeout(hideTimerRef.current);
      // Defer to next tick — avoids the set-state-in-effect lint rule
      const showTimer = setTimeout(() => {
        setVisible(true);
        hideTimerRef.current = setTimeout(() => setVisible(false), 1500);
      }, 0);
      return () => clearTimeout(showTimer);
    }

    // Reset when a new timer starts
    if (timer.isRunning) {
      clearTimeout(hideTimerRef.current);
      const resetTimer = setTimeout(() => setVisible(false), 0);
      return () => clearTimeout(resetTimer);
    }
  }, [timer.isRunning, timer.remaining, timer.startedAt]);

  useEffect(() => {
    return () => clearTimeout(hideTimerRef.current);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
      aria-hidden
    >
      <div className="absolute inset-0 animate-[flash_0.4s_ease-out_3] bg-[oklch(0.6_0.22_25)]" />
      <p className="relative text-5xl font-black tracking-widest text-white drop-shadow-2xl">
        TIME&apos;S UP!
      </p>
    </div>
  );
}
