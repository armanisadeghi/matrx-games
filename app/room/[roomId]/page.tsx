"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";
import { RoomCodeDisplay } from "@/features/lobby/components/RoomCodeDisplay";
import { PlayerList } from "@/features/lobby/components/PlayerList";
import { TeamSelfAssign } from "@/features/lobby/components/TeamSelfAssign";
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
  const { assignTeam } = useTeams(params.roomId);
  const [currentPlayerId] = useState(
    () =>
      (typeof window !== "undefined"
        ? localStorage.getItem("player_id")
        : null) ?? "",
  );
  useWakeLock();

  const knownPlayerIdsRef = useRef<Set<string>>(new Set());

  const currentPlayer: Player | null =
    players.find((p) => p.id === currentPlayerId) ?? null;

  const isHost = currentPlayer?.role === "host";

  const onPlayersUpdate = useCallback(
    (connected: Player[]) => {
      const connectedIds = new Set(connected.map((p) => p.id));

      const hasNewPlayer = connected.some(
        (p) => !knownPlayerIdsRef.current.has(p.id),
      );

      if (hasNewPlayer) {
        fetchRoom(params.roomId);
      }

      setPlayers((prev) => {
        const updated = prev.map((p) => ({
          ...p,
          isConnected: connectedIds.has(p.id),
        }));
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

  // Listen for team:update broadcasts so all clients see team changes live
  useEffect(() => {
    const unsub = gameRealtime.onBroadcast(
      params.roomId,
      "team:update",
      (payload) => {
        const { playerId, teamId } = payload as {
          playerId: string;
          teamId: string | null;
        };
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, teamId } : p)),
        );
      },
    );
    return unsub;
  }, [params.roomId, setPlayers]);

  // Non-host: listen for game:start broadcast to navigate immediately
  useEffect(() => {
    if (isHost) return;
    const unsub = gameRealtime.onBroadcast(params.roomId, "game:start", () => {
      router.push(ROUTES.ROOM_PLAY(params.roomId));
    });
    return unsub;
  }, [isHost, params.roomId, router]);

  const handleJoinTeam = async (teamId: string) => {
    if (!currentPlayerId) return;
    const { error } = await assignTeam(currentPlayerId, teamId);
    if (error) toast.error("Failed to join team");
    else {
      // Optimistic local update
      setPlayers((prev) =>
        prev.map((p) => (p.id === currentPlayerId ? { ...p, teamId } : p)),
      );
    }
  };

  const handleLeaveTeam = async () => {
    if (!currentPlayerId) return;
    const { error } = await assignTeam(currentPlayerId, null);
    if (error) toast.error("Failed to leave team");
    else {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === currentPlayerId ? { ...p, teamId: null } : p,
        ),
      );
    }
  };

  const handleStartGame = async () => {
    if (!isHost || players.length < 2) return;

    // Require at least 2 teams with at least 1 player each
    const teamsWithPlayers = new Set(
      players.filter((p) => p.teamId).map((p) => p.teamId),
    );
    if (teamsWithPlayers.size < 2) {
      toast.error(
        "At least 2 teams are needed. Ask players to pick a team first.",
      );
      return;
    }

    const unteamed = players.filter((p) => !p.teamId);
    if (unteamed.length > 0) {
      toast.error(
        `${unteamed.map((p) => p.displayName).join(", ")} still need${unteamed.length === 1 ? "s" : ""} to pick a team.`,
      );
      return;
    }

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

      <TeamSelfAssign
        players={players}
        currentPlayerId={currentPlayerId}
        onJoinTeam={handleJoinTeam}
        onLeaveTeam={handleLeaveTeam}
      />

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
