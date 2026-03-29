"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowRight } from "lucide-react";

interface RoundResultsProps {
  word: string;
  winnerName: string | null;
  scores: Record<string, number>;
  isHost: boolean;
  onNextRound: () => void;
  isLastRound: boolean;
}

export function RoundResults({
  word,
  winnerName,
  scores,
  isHost,
  onNextRound,
  isLastRound,
}: RoundResultsProps) {
  const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);

  return (
    <div className="flex flex-col items-center gap-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Round Over</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">The word was</p>
          <p className="mt-1 text-3xl font-bold">{word}</p>

          {winnerName ? (
            <Badge className="mt-4" variant="secondary">
              <CheckCircle className="mr-1 h-3 w-3" />
              {winnerName} guessed it!
            </Badge>
          ) : (
            <Badge className="mt-4" variant="outline">
              Time ran out - nobody guessed it
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card className="w-full max-w-md">
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Team Scores
          </p>
          {sortedScores.map(([team, score]) => (
            <div
              key={team}
              className="flex items-center justify-between py-1"
            >
              <span className="text-sm font-medium">{team}</span>
              <span className="font-mono text-lg font-bold">{score}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {isHost && (
        <Button onClick={onNextRound} size="lg">
          {isLastRound ? "See Final Results" : "Next Round"}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      )}

      {!isHost && (
        <p className="text-sm text-muted-foreground">
          Waiting for host to continue...
        </p>
      )}
    </div>
  );
}
