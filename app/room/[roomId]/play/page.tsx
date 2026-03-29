"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useRoom } from "@/features/lobby/hooks/useRoom";
import { useRoomRealtime } from "@/features/lobby/hooks/useRoomRealtime";
import { getGame } from "@/games/registry";
import type { Player } from "@/games/types";
import { gameRealtime } from "@/lib/game-engine/GameRealtimeService";

export default function PlayPage() {
  const params = useParams<{ roomId: string }>();
  const { room, players, isLoading, fetchRoom, setPlayers } = useRoom();
  const [currentPlayerId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem("player_id") : null) ?? ""
  );

  const currentPlayer: Player | null =
    players.find((p) => p.id === currentPlayerId) ?? null;

  const isHost = currentPlayer?.role === "host";

  const onPlayersUpdate = useCallback(
    (connected: Player[]) => {
      setPlayers((prev) =>
        prev.map((p) => {
          const match = connected.find((c) => c.id === p.id);
          return match ? { ...p, isConnected: true } : { ...p, isConnected: false };
        })
      );
    },
    [setPlayers]
  );

  useRoomRealtime({
    roomId: params.roomId,
    player: currentPlayer ?? {
      id: currentPlayerId,
      userId: null,
      displayName:
        (typeof window !== "undefined" ? localStorage.getItem("display_name") : null) ?? "Player",
      avatarUrl: null,
      teamId: null,
      role: "player",
      gameRole: null,
      isConnected: true,
      guestToken: null,
    },
    onPlayersUpdate,
  });

  useEffect(() => {
    if (params.roomId) {
      fetchRoom(params.roomId);
    }
  }, [params.roomId, fetchRoom]);

  if (isLoading || !room) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gameDef = getGame(room.gameSlug);
  if (!gameDef) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-muted-foreground">Game not found: {room.gameSlug}</p>
      </div>
    );
  }

  const GameComponent = gameDef.GameComponent;

  const broadcastEvent = (event: string, payload: unknown) => {
    gameRealtime.broadcastEvent(room.id, event, payload);
  };

  const onBroadcast = (event: string, handler: (payload: unknown) => void) => {
    return gameRealtime.onBroadcast(room.id, event, handler);
  };

  return (
    <div className="min-h-dvh">
      <GameComponent
        room={room}
        player={
          currentPlayer ?? {
            id: currentPlayerId,
            userId: null,
            displayName: "Player",
            avatarUrl: null,
            teamId: null,
            role: "player",
            gameRole: null,
            isConnected: true,
            guestToken: null,
          }
        }
        players={players}
        gameState={{}}
        isHost={isHost}
        broadcastEvent={broadcastEvent}
        onBroadcast={onBroadcast}
      />
    </div>
  );
}
