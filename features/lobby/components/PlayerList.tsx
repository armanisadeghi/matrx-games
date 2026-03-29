"use client";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Player } from "@/games/types";

interface PlayerListProps {
  players: Player[];
  currentPlayerId: string;
}

export function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Players ({players.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  player.isConnected ? "bg-green-500" : "bg-muted-foreground"
                }`}
              />
              <span className="text-sm font-medium">
                {player.displayName}
                {player.id === currentPlayerId && (
                  <span className="ml-1 text-muted-foreground">(you)</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {player.role === "host" && (
                <Badge variant="secondary" className="text-xs">
                  Host
                </Badge>
              )}
              {player.teamId && (
                <Badge variant="outline" className="text-xs">
                  {player.teamId}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
