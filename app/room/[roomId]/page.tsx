"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";
import { RoomCodeDisplay } from "@/features/lobby/components/RoomCodeDisplay";
import { PlayerList } from "@/features/lobby/components/PlayerList";
import { useRoom } from "@/features/lobby/hooks/useRoom";
import { useRoomRealtime } from "@/features/lobby/hooks/useRoomRealtime";
import { useTeams } from "@/features/lobby/hooks/useTeams";
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
    () => (typeof window !== "undefined" ? localStorage.getItem("player_id") : null) ?? ""
  );

  const currentPlayer: Player | null = players.find(
    (p) => p.id === currentPlayerId
  ) ?? null;

  const isHost = currentPlayer?.role === "host";

  const onPlayersUpdate = useCallback(
    (connected: Player[]) => {
      setPlayers((prev) => {
        // Merge presence data with DB data
        return prev.map((p) => {
          const match = connected.find((c) => c.id === p.id);
          return match ? { ...p, isConnected: true } : { ...p, isConnected: false };
        });
      });
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

  // Listen for game start
  useEffect(() => {
    if (room?.status === "playing") {
      router.push(ROUTES.ROOM_PLAY(room.id));
    }
  }, [room?.status, room?.id, router]);

  const handleStartGame = async () => {
    if (!isHost || players.length < 2) return;

    // Auto-balance teams if no one has been assigned
    const unassigned = players.filter((p) => !p.teamId);
    if (unassigned.length > 0) {
      const assignments = autoBalanceTeams(players);
      // Update in database
      for (const [playerId, teamId] of assignments) {
        const { error } = await (await import("@/utils/supabase/client")).supabase
          .from("game_players")
          .update({ team_id: teamId })
          .eq("id", playerId);
        if (error) {
          toast.error("Failed to assign teams");
          return;
        }
      }
    }

    await updateRoomStatus("playing");
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
