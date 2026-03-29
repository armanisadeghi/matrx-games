"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Eye } from "lucide-react";
import { GameTimer } from "@/features/timer/components/GameTimer";
import type { TimerState } from "@/features/timer/types";

interface SpectatorViewProps {
  timer: TimerState;
  activeTeam: string;
  drawerName: string;
  scores: Record<string, number>;
}

export function SpectatorView({
  timer,
  activeTeam,
  drawerName,
  scores,
}: SpectatorViewProps) {
  const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);

  return (
    <div className="flex flex-col items-center gap-6">
      <Badge variant="outline" className="text-sm">
        <Eye className="mr-1 h-3 w-3" />
        Spectating
      </Badge>

      <GameTimer timer={timer} size="lg" />

      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <p className="text-lg font-medium">
            {activeTeam} is playing
          </p>
          <p className="text-sm text-muted-foreground">
            {drawerName} is describing a word to their team
          </p>
        </CardContent>
      </Card>

      {sortedScores.length > 0 && (
        <Card className="w-full max-w-md">
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Scores
            </p>
            {sortedScores.map(([team, score]) => (
              <div
                key={team}
                className="flex items-center justify-between py-1"
              >
                <span className="text-sm font-medium">{team}</span>
                <span className="font-mono text-sm font-bold">{score}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
