"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";
import { RoomCodeDisplay } from "@/features/lobby/components/RoomCodeDisplay";
import { PlayerList } from "@/features/lobby/components/PlayerList";
import { useRoom } from "@/features/lobby/hooks/useRoom";
import { useRoomRealtime } from "@/features/lobby/hooks/useRoomRealtime";
import { useTeams } from "@/features/lobby/hooks/useTeams";
import { gameRealtime } from "@/lib/game-engine/GameRealtimeService";
import { useWakeLock } from "@/hooks/useWakeLock";
import { ROUTES } from "@/constants/routes";
import { toast } from "sonner";
import type { Player } from "@/games/types";

export default function RoomLobbyPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const { room, players, isLoading, fetchRoom, setPlayers, updateRoomStatus } =
    useRoom();
  const { autoBalanceTeams } = useTeams(params.roomId);
  const [currentPlayerId] = useState(
    () =>
      (typeof window !== "undefined"
        ? localStorage.getItem("player_id")
        : null) ?? "",
  );
  useWakeLock();

  // Track which player IDs we've already loaded from DB to detect new arrivals
  const knownPlayerIdsRef = useRef<Set<string>>(new Set());

  const currentPlayer: Player | null =
    players.find((p) => p.id === currentPlayerId) ?? null;

  const isHost = currentPlayer?.role === "host";

  const onPlayersUpdate = useCallback(
    (connected: Player[]) => {
      const connectedIds = new Set(connected.map((p) => p.id));

      // Check if any connected player is not yet in our DB-fetched list
      const hasNewPlayer = connected.some(
        (p) => !knownPlayerIdsRef.current.has(p.id),
      );

      if (hasNewPlayer) {
        // Re-fetch from DB to pick up the new player row
        fetchRoom(params.roomId);
      }

      // Update connected status on existing players
      setPlayers((prev) => {
        const updated = prev.map((p) => ({
          ...p,
          isConnected: connectedIds.has(p.id),
        }));
        // Update known IDs
        updated.forEach((p) => knownPlayerIdsRef.current.add(p.id));
        return updated;
      });
    },
    [setPlayers, fetchRoom, params.roomId],
  );

  useRoomRealtime({
    roomId: params.roomId,
    player: currentPlayer ?? {
      id: currentPlayerId,
      userId: null,
      displayName:
        (typeof window !== "undefined"
          ? localStorage.getItem("display_name")
          : null) ?? "Player",
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

  // Non-host: listen for game:start broadcast to navigate immediately
  useEffect(() => {
    if (isHost) return;
    const unsub = gameRealtime.onBroadcast(params.roomId, "game:start", () => {
      router.push(ROUTES.ROOM_PLAY(params.roomId));
    });
    return unsub;
  }, [isHost, params.roomId, router]);

  const handleStartGame = async () => {
    if (!isHost || players.length < 2) return;

    // Auto-balance teams if no one has been assigned
    const unassigned = players.filter((p) => !p.teamId);
    if (unassigned.length > 0) {
      const assignments = autoBalanceTeams(players);
      for (const [playerId, teamId] of assignments) {
        const { error } = await (
          await import("@/utils/supabase/client")
        ).supabase
          .from("game_players")
          .update({ team_id: teamId })
          .eq("id", playerId);
        if (error) {
          toast.error("Failed to assign teams");
          return;
        }
      }
    }

    // Broadcast before updating DB so clients navigate while status is updating
    await gameRealtime.broadcastEvent(params.roomId, "game:start", {});
    await updateRoomStatus("playing");
    router.push(ROUTES.ROOM_PLAY(params.roomId));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-muted-foreground">Room not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Game Lobby</h1>

      <RoomCodeDisplay roomCode={room.roomCode} />

      <PlayerList players={players} currentPlayerId={currentPlayerId} />

      {isHost && (
        <Button
          onClick={handleStartGame}
          size="lg"
          className="mt-4"
          disabled={players.length < 2}
        >
          <Play className="mr-1 h-4 w-4" />
          Start Game ({players.length} players)
        </Button>
      )}

      {!isHost && (
        <p className="text-center text-sm text-muted-foreground">
          Waiting for host to start the game...
        </p>
      )}
    </div>
  );
}
