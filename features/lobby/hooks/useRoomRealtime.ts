"use client";

import { useEffect, useRef } from "react";
import {
  gameRealtime,
  type PresenceState,
} from "@/lib/game-engine/GameRealtimeService";
import type { Player } from "@/games/types";

interface UseRoomRealtimeOptions {
  roomId: string;
  player: Player;
  onPlayersUpdate: (players: Player[]) => void;
}

export function useRoomRealtime({
  roomId,
  player,
  onPlayersUpdate,
}: UseRoomRealtimeOptions) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const presenceState: PresenceState = {
      playerId: player.id,
      displayName: player.displayName,
      teamId: player.teamId,
      gameRole: player.gameRole,
      isReady: false,
    };

    gameRealtime.joinRoom(roomId, presenceState, (state) => {
      const connected: Player[] = [];
      for (const [, presences] of Object.entries(state)) {
        for (const p of presences) {
          connected.push({
            id: p.playerId,
            userId: null,
            displayName: p.displayName,
            avatarUrl: null,
            teamId: p.teamId,
            role: "player",
            gameRole: p.gameRole,
            isConnected: true,
            guestToken: null,
          });
        }
      }
      onPlayersUpdate(connected);
    });

    cleanupRef.current = () => {
      gameRealtime.leaveRoom(roomId);
    };

    return () => {
      cleanupRef.current?.();
    };
  }, [roomId, player.id, player.displayName, player.teamId, player.gameRole, onPlayersUpdate]);

  return { gameRealtime };
}
