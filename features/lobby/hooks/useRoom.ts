"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import type { Room, Player } from "@/games/types";

export function useRoom(roomId?: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoom = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: roomData, error: roomError } = await supabase
        .from("game_rooms")
        .select("*, game_catalog(slug)")
        .eq("id", id)
        .single();

      if (roomError) throw roomError;

      setRoom({
        id: roomData.id,
        gameId: roomData.game_id,
        gameSlug: roomData.game_catalog?.slug ?? "",
        hostId: roomData.host_id,
        roomCode: roomData.room_code,
        status: roomData.status,
        settings: roomData.settings ?? {},
        maxPlayers: roomData.max_players,
        createdAt: roomData.created_at,
        startedAt: roomData.started_at,
        finishedAt: roomData.finished_at,
      });

      const { data: playersData, error: playersError } = await supabase
        .from("game_players")
        .select("*")
        .eq("room_id", id)
        .is("left_at", null);

      if (playersError) throw playersError;

      setPlayers(
        (playersData ?? []).map((p) => ({
          id: p.id,
          userId: p.user_id,
          displayName: p.display_name,
          avatarUrl: p.avatar_url,
          teamId: p.team_id,
          role: p.role,
          gameRole: p.game_role,
          isConnected: p.is_connected,
          guestToken: p.guest_token,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load room");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateRoomStatus = useCallback(
    async (status: Room["status"]) => {
      if (!room) return;
      const { error: err } = await supabase
        .from("game_rooms")
        .update({
          status,
          ...(status === "playing" ? { started_at: new Date().toISOString() } : {}),
          ...(status === "finished" ? { finished_at: new Date().toISOString() } : {}),
        })
        .eq("id", room.id);
      if (err) {
        setError(err.message);
      } else {
        setRoom((prev) => (prev ? { ...prev, status } : null));
      }
    },
    [room]
  );

  return {
    room,
    players,
    isLoading,
    error,
    fetchRoom,
    setPlayers,
    setRoom,
    updateRoomStatus,
  };
}
