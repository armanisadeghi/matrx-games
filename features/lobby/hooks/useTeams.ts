"use client";

import { useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import { gameRealtime } from "@/lib/game-engine/GameRealtimeService";
import type { Player } from "@/games/types";

export function useTeams(roomId: string) {
  const assignTeam = useCallback(
    async (playerId: string, teamId: string | null) => {
      const { error } = await supabase
        .from("game_players")
        .update({ team_id: teamId })
        .eq("id", playerId);

      if (!error) {
        await gameRealtime.broadcastEvent(roomId, "team:update", {
          playerId,
          teamId,
        });
      }

      return { error: error?.message ?? null };
    },
    [roomId]
  );

  const autoBalanceTeams = useCallback(
    (players: Player[], teamCount = 2): Map<string, string> => {
      const assignments = new Map<string, string>();
      const teamNames = Array.from(
        { length: teamCount },
        (_, i) => `team-${String.fromCharCode(65 + i)}`
      );

      const shuffled = [...players].sort(() => Math.random() - 0.5);
      shuffled.forEach((p, i) => {
        assignments.set(p.id, teamNames[i % teamCount]);
      });

      return assignments;
    },
    []
  );

  return { assignTeam, autoBalanceTeams };
}
