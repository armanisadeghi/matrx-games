"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";

interface GameOverScreenProps {
  teamScores: Record<string, number>;
  playerScores: Record<string, number>;
  playerNames: Record<string, string>;
  isHost: boolean;
  onPlayAgain: () => void;
}

export function GameOverScreen({
  teamScores,
  playerScores,
  playerNames,
  isHost,
  onPlayAgain,
}: GameOverScreenProps) {
  const sortedTeams = Object.entries(teamScores).sort(([, a], [, b]) => b - a);
  const sortedPlayers = Object.entries(playerScores).sort(
    ([, a], [, b]) => b - a
  );
  const winner = sortedTeams[0];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-8 w-8 text-yellow-500" />
        <h2 className="text-3xl font-bold">Game Over!</h2>
      </div>

      {winner && (
        <Card className="w-full max-w-md border-yellow-500/50">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Winner</p>
            <p className="mt-1 text-2xl font-bold">{winner[0]}</p>
            <p className="font-mono text-lg text-muted-foreground">
              {winner[1]} points
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Team Scores</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedTeams.map(([team, score], i) => (
            <div
              key={team}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  #{i + 1}
                </span>
                <span className="font-medium">{team}</span>
              </div>
              <span className="font-mono font-bold">{score}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Top Players</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedPlayers.slice(0, 5).map(([id, score], i) => (
            <div
              key={id}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  #{i + 1}
                </span>
                <span className="font-medium">
                  {playerNames[id] ?? "Unknown"}
                </span>
              </div>
              <span className="font-mono font-bold">{score}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {isHost && (
          <Button onClick={onPlayAgain} size="lg">
            <RotateCcw className="mr-1 h-4 w-4" />
            Play Again
          </Button>
        )}
        <Button variant="outline" size="lg" render={<Link href={ROUTES.HOME} />}>
          <Home className="mr-1 h-4 w-4" />
          Back to Games
        </Button>
      </div>
    </div>
  );
}
