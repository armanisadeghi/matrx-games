"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Play, RefreshCw } from "lucide-react";
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

  // Listen for team:update broadcasts — apply optimistically AND re-fetch to stay in sync
  useEffect(() => {
    const unsub = gameRealtime.onBroadcast(
      params.roomId,
      "team:update",
      (payload) => {
        const { playerId, teamId } = payload as {
          playerId: string;
          teamId: string | null;
        };
        // Immediate optimistic update so the UI doesn't flicker
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, teamId } : p)),
        );
        // Then sync with DB so we have ground truth (catches missed broadcasts too)
        fetchRoom(params.roomId);
      },
    );
    return unsub;
  }, [params.roomId, setPlayers, fetchRoom]);

  // Non-host: listen for game:start broadcast to navigate immediately
  useEffect(() => {
    if (isHost) return;
    const unsub = gameRealtime.onBroadcast(params.roomId, "game:start", () => {
      router.push(ROUTES.ROOM_PLAY(params.roomId));
    });
    return unsub;
  }, [isHost, params.roomId, router]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRoom(params.roomId);
    setIsRefreshing(false);
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!currentPlayerId) return;
    // Optimistic update first so the UI is instant
    setPlayers((prev) =>
      prev.map((p) => (p.id === currentPlayerId ? { ...p, teamId } : p)),
    );
    const { error } = await assignTeam(currentPlayerId, teamId);
    if (error) {
      toast.error("Failed to join team");
      // Roll back optimistic update
      await fetchRoom(params.roomId);
    } else {
      // Re-fetch so our local state exactly matches DB (catches any edge cases)
      await fetchRoom(params.roomId);
    }
  };

  const handleLeaveTeam = async () => {
    if (!currentPlayerId) return;
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === currentPlayerId ? { ...p, teamId: null } : p,
      ),
    );
    const { error } = await assignTeam(currentPlayerId, null);
    if (error) {
      toast.error("Failed to leave team");
      await fetchRoom(params.roomId);
    } else {
      await fetchRoom(params.roomId);
    }
  };

  const [isStarting, setIsStarting] = useState(false);

  const handleStartGame = async () => {
    if (!isHost || isStarting) return;
    setIsStarting(true);

    try {
      // Always re-fetch fresh player state from DB before validating —
      // local state can be stale if team:update broadcasts were missed
      await fetchRoom(params.roomId);

      // Read fresh players directly from DB to avoid stale closure
      const { supabase } = await import("@/utils/supabase/client");
      const { data: freshPlayers } = await supabase
        .from("game_players")
        .select("id, display_name, role, team_id, guest_token, user_id")
        .eq("room_id", params.roomId)
        .is("left_at", null);

      if (!freshPlayers || freshPlayers.length < 2) {
        toast.error("Need at least 2 players to start.");
        return;
      }

      const teamsWithPlayers = new Set(
        freshPlayers.filter((p) => p.team_id).map((p) => p.team_id),
      );

      // If fewer than 2 teams, auto-assign using the balanced split so the game
      // can always start — never block the host
      if (teamsWithPlayers.size < 2) {
        const shuffled = [...freshPlayers].sort(() => Math.random() - 0.5);
        const teamNames = ["Team A", "Team B"];
        await Promise.all(
          shuffled.map((p, i) =>
            supabase
              .from("game_players")
              .update({ team_id: teamNames[i % 2] })
              .eq("id", p.id),
          ),
        );
        toast.info("Teams auto-assigned — tap Refresh if you want to switch before the round starts.");
      }

      // Any remaining unteamed players after the auto-assign above are assigned
      // to Team A as a safety net
      const unteamed = freshPlayers.filter((p) => !p.team_id);
      if (unteamed.length > 0) {
        await Promise.all(
          unteamed.map((p) =>
            supabase
              .from("game_players")
              .update({ team_id: "Team A" })
              .eq("id", p.id),
          ),
        );
      }

      await gameRealtime.broadcastEvent(params.roomId, "game:start", {});
      await updateRoomStatus("playing");
      router.push(ROUTES.ROOM_PLAY(params.roomId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setIsStarting(false);
    }
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Game Lobby</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-1.5 text-muted-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

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
          disabled={players.length < 2 || isStarting}
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="mr-1 h-4 w-4" />
              Start Game ({players.length} players)
            </>
          )}
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
