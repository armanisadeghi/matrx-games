"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { gameRealtime } from "@/lib/game-engine/GameRealtimeService";

interface EmergencyResetProps {
  roomId: string;
  playerId: string;
  playerName: string;
  onReset: () => void;
}

const VOTE_TIMEOUT_MS = 15000;

export function EmergencyReset({
  roomId,
  playerId,
  playerName,
  onReset,
}: EmergencyResetProps) {
  const [iHaveVoted, setIHaveVoted] = useState(false);
  // Track voter IDs in a ref to avoid stale closure issues in callbacks
  const voterIdsRef = useRef<Set<string>>(new Set());
  const voteTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clearMyVote = useCallback(() => {
    setIHaveVoted(false);
    voterIdsRef.current.delete(playerId);
  }, [playerId]);

  const handleVote = useCallback(() => {
    if (iHaveVoted) return;
    setIHaveVoted(true);
    voterIdsRef.current.add(playerId);

    if (voterIdsRef.current.size >= 2) {
      onReset();
      voterIdsRef.current = new Set();
      return;
    }

    gameRealtime.broadcastEvent(roomId, "reset:confirm", {
      confirmerId: playerId,
    });

    clearTimeout(voteTimerRef.current);
    voteTimerRef.current = setTimeout(clearMyVote, VOTE_TIMEOUT_MS);
  }, [iHaveVoted, playerId, roomId, onReset, clearMyVote]);

  useEffect(() => {
    const unsubRequest = gameRealtime.onBroadcast(
      roomId,
      "reset:request",
      (payload) => {
        const { requestorId, requestorName } = payload as {
          requestorId: string;
          requestorName: string;
        };
        if (requestorId === playerId) return;

        voterIdsRef.current.add(requestorId);

        toast(`${requestorName} wants to restart the round`, {
          description: "Tap to agree and restart",
          action: {
            label: "Agree",
            onClick: handleVote,
          },
          duration: VOTE_TIMEOUT_MS,
        });
      },
    );

    const unsubConfirm = gameRealtime.onBroadcast(
      roomId,
      "reset:confirm",
      (payload) => {
        const { confirmerId } = payload as { confirmerId: string };
        if (confirmerId === playerId) return;
        voterIdsRef.current.add(confirmerId);
        if (voterIdsRef.current.size >= 2) {
          onReset();
          voterIdsRef.current = new Set();
        }
      },
    );

    return () => {
      unsubRequest();
      unsubConfirm();
      clearTimeout(voteTimerRef.current);
    };
  }, [roomId, playerId, onReset, handleVote]);

  const handleRequestReset = useCallback(() => {
    if (iHaveVoted) {
      toast.info("You already voted to restart. Waiting for others to agree.");
      return;
    }

    setIHaveVoted(true);
    voterIdsRef.current.add(playerId);

    gameRealtime.broadcastEvent(roomId, "reset:request", {
      requestorId: playerId,
      requestorName: playerName,
    });

    toast.info("Restart request sent — one more player needs to agree.", {
      duration: VOTE_TIMEOUT_MS,
    });

    clearTimeout(voteTimerRef.current);
    voteTimerRef.current = setTimeout(clearMyVote, VOTE_TIMEOUT_MS);
  }, [iHaveVoted, playerId, playerName, roomId, clearMyVote]);

  return (
    <button
      onClick={handleRequestReset}
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur-sm transition-all active:scale-95 ${
        iHaveVoted
          ? "border-[oklch(0.72_0.18_50)]/50 bg-[oklch(0.72_0.18_50)]/20 text-[oklch(0.55_0.18_50)] dark:text-[oklch(0.82_0.18_50)]"
          : "border-border bg-background/80 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
      }`}
    >
      {iHaveVoted ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <RotateCcw className="h-4 w-4" />
      )}
      {iHaveVoted ? "Waiting..." : "Restart?"}
    </button>
  );
}
