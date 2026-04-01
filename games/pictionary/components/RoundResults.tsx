"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, ArrowRight } from "lucide-react";
import { DIFFICULTY_CONFIG } from "../constants";
import type { PictionaryDifficultyLevel } from "../types";

interface RoundResultsProps {
  word: string;
  winnerName: string | null;
  scores: Record<string, number>;
  isHost: boolean;
  onNextRound: () => void;
  isLastRound: boolean;
  category?: string;
  difficulty?: PictionaryDifficultyLevel;
  pointValue?: number;
}

export function RoundResults({
  word,
  winnerName,
  scores,
  isHost,
  onNextRound,
  isLastRound,
  category,
  difficulty,
  pointValue,
}: RoundResultsProps) {
  const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const won = !!winnerName;
  const diffCfg = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;
  const points = pointValue ?? diffCfg?.points;

  return (
    <div className="flex flex-1 flex-col items-center gap-6">
      {/* Result banner */}
      <div
        className={`flex w-full flex-col items-center gap-3 rounded-2xl p-8 text-center ${
          won
            ? "bg-[oklch(0.75_0.18_150)]/15 border-2 border-[oklch(0.75_0.18_150)]/30"
            : "bg-[oklch(0.65_0.18_30)]/10 border-2 border-[oklch(0.65_0.18_30)]/25"
        }`}
      >
        {won ? (
          <CheckCircle className="h-14 w-14 text-[oklch(0.6_0.18_150)]" />
        ) : (
          <Clock className="h-14 w-14 text-[oklch(0.6_0.18_30)]" />
        )}

        <div>
          <p className="text-base text-muted-foreground uppercase tracking-widest">
            {won ? "Correct!" : "Time's up"}
          </p>
          {winnerName && (
            <p className="text-xl font-bold text-[oklch(0.55_0.18_150)] dark:text-[oklch(0.75_0.18_150)]">
              {winnerName} guessed it!
            </p>
          )}
          {won && points && (
            <p className="text-base text-muted-foreground">
              +{points} pts earned
            </p>
          )}
        </div>

        <div className="mt-2">
          <p className="text-sm text-muted-foreground">The word was</p>
          <p className="text-5xl font-black tracking-tight">{word}</p>
          {(category || diffCfg) && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {diffCfg && (
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-bold ${diffCfg.bg} ${diffCfg.border} ${diffCfg.color}`}
                >
                  {diffCfg.label}
                </span>
              )}
              {category && (
                <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-medium text-muted-foreground">
                  {category}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scores */}
      <div className="w-full rounded-2xl border bg-card p-5">
        <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          Team Scores
        </p>
        <div className="flex flex-col gap-2">
          {sortedScores.map(([team, score], i) => (
            <div
              key={team}
              className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-lg font-black ${
                    i === 0
                      ? "text-[oklch(0.75_0.18_50)] dark:text-[oklch(0.85_0.18_50)]"
                      : "text-muted-foreground"
                  }`}
                >
                  #{i + 1}
                </span>
                <span className="text-lg font-semibold">{team}</span>
              </div>
              <span className="font-mono text-2xl font-bold">{score}</span>
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <Button onClick={onNextRound} size="lg" className="h-16 w-full text-xl">
          {isLastRound ? "See Final Results" : "Next Round"}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      ) : (
        <p className="text-base text-muted-foreground">
          Waiting for host to continue...
        </p>
      )}
    </div>
  );
}
