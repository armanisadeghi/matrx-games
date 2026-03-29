"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { gameRealtime } from "@/lib/game-engine/GameRealtimeService";
import type { TimerSyncPayload } from "@/lib/game-engine/event-types";
import type { TimerState } from "../types";

interface UseSyncedTimerOptions {
  roomId: string;
  isHost: boolean;
  duration: number;
  onComplete?: () => void;
}

export function useSyncedTimer({
  roomId,
  isHost,
  duration,
  onComplete,
}: UseSyncedTimerOptions) {
  const [timer, setTimer] = useState<TimerState>({
    startedAt: null,
    duration,
    isPaused: false,
    pausedAt: null,
    isRunning: false,
    remaining: duration,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const completedRef = useRef(false);

  const computeRemaining = useCallback(
    (state: { startedAt: number; duration: number; isPaused: boolean; pausedAt: number | null }) => {
      if (state.isPaused && state.pausedAt) {
        return Math.max(0, state.duration - (state.pausedAt - state.startedAt));
      }
      return Math.max(0, state.duration - (Date.now() - state.startedAt));
    },
    []
  );

  // Listen for timer sync broadcasts (non-host)
  useEffect(() => {
    if (isHost) return;

    const unsub = gameRealtime.onBroadcast(roomId, "timer:sync", (payload) => {
      const sync = payload as TimerSyncPayload;
      const remaining = computeRemaining({
        startedAt: sync.startedAt,
        duration: sync.duration,
        isPaused: sync.isPaused,
        pausedAt: sync.pausedAt,
      });

      setTimer({
        startedAt: sync.startedAt,
        duration: sync.duration,
        isPaused: sync.isPaused,
        pausedAt: sync.pausedAt,
        isRunning: !sync.isPaused && remaining > 0,
        remaining,
      });
    });

    return unsub;
  }, [roomId, isHost, computeRemaining]);

  // Tick every 100ms to update remaining
  useEffect(() => {
    if (!timer.isRunning || !timer.startedAt) return;

    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (!prev.startedAt || prev.isPaused) return prev;
        const remaining = computeRemaining({
          startedAt: prev.startedAt,
          duration: prev.duration,
          isPaused: prev.isPaused,
          pausedAt: prev.pausedAt,
        });

        if (remaining <= 0 && !completedRef.current) {
          completedRef.current = true;
          onComplete?.();
          return { ...prev, remaining: 0, isRunning: false };
        }

        return { ...prev, remaining };
      });
    }, 100);

    return () => clearInterval(intervalRef.current);
  }, [timer.isRunning, timer.startedAt, computeRemaining, onComplete]);

  // Host broadcasts timer sync every second
  useEffect(() => {
    if (!isHost || !timer.isRunning || !timer.startedAt) return;

    syncIntervalRef.current = setInterval(() => {
      const syncPayload: TimerSyncPayload = {
        startedAt: timer.startedAt!,
        duration: timer.duration,
        isPaused: timer.isPaused,
        pausedAt: timer.pausedAt,
      };
      gameRealtime.broadcastEvent(roomId, "timer:sync", syncPayload);
    }, 1000);

    return () => clearInterval(syncIntervalRef.current);
  }, [isHost, roomId, timer.isRunning, timer.startedAt, timer.duration, timer.isPaused, timer.pausedAt]);

  const start = useCallback(
    (customDuration?: number) => {
      const d = customDuration ?? duration;
      completedRef.current = false;
      const now = Date.now();

      setTimer({
        startedAt: now,
        duration: d,
        isPaused: false,
        pausedAt: null,
        isRunning: true,
        remaining: d,
      });

      if (isHost) {
        gameRealtime.broadcastEvent(roomId, "timer:sync", {
          startedAt: now,
          duration: d,
          isPaused: false,
          pausedAt: null,
        } satisfies TimerSyncPayload);
      }
    },
    [duration, isHost, roomId]
  );

  const pause = useCallback(() => {
    const now = Date.now();
    setTimer((prev) => ({
      ...prev,
      isPaused: true,
      pausedAt: now,
      isRunning: false,
    }));

    if (isHost) {
      setTimer((prev) => {
        gameRealtime.broadcastEvent(roomId, "timer:sync", {
          startedAt: prev.startedAt!,
          duration: prev.duration,
          isPaused: true,
          pausedAt: now,
        } satisfies TimerSyncPayload);
        return prev;
      });
    }
  }, [isHost, roomId]);

  const resume = useCallback(() => {
    setTimer((prev) => {
      if (!prev.startedAt || !prev.pausedAt) return prev;
      const pausedDuration = Date.now() - prev.pausedAt;
      const newStartedAt = prev.startedAt + pausedDuration;

      if (isHost) {
        gameRealtime.broadcastEvent(roomId, "timer:sync", {
          startedAt: newStartedAt,
          duration: prev.duration,
          isPaused: false,
          pausedAt: null,
        } satisfies TimerSyncPayload);
      }

      return {
        ...prev,
        startedAt: newStartedAt,
        isPaused: false,
        pausedAt: null,
        isRunning: true,
      };
    });
  }, [isHost, roomId]);

  const reset = useCallback(() => {
    completedRef.current = false;
    setTimer({
      startedAt: null,
      duration,
      isPaused: false,
      pausedAt: null,
      isRunning: false,
      remaining: duration,
    });

    if (isHost) {
      gameRealtime.broadcastEvent(roomId, "timer:reset", {});
    }
  }, [duration, isHost, roomId]);

  return { timer, start, pause, resume, reset };
}
