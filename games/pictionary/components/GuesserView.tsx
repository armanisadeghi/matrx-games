"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, CheckCircle, XCircle } from "lucide-react";
import { GameTimer } from "@/features/timer/components/GameTimer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DIFFICULTY_CONFIG } from "../constants";
import type { TimerState } from "@/features/timer/types";
import type { PictionaryGuess, PictionaryDifficultyLevel } from "../types";

interface GuesserViewProps {
  timer: TimerState;
  guesses: PictionaryGuess[];
  onGuess: (guess: string) => void;
  drawerName: string;
  isGuessing: boolean;
  category?: string;
  difficulty?: PictionaryDifficultyLevel;
  pointValue?: number;
}

export function GuesserView({
  timer,
  guesses,
  onGuess,
  drawerName,
  isGuessing,
  category,
  difficulty,
  pointValue,
}: GuesserViewProps) {
  const [input, setInput] = useState("");
  const diffCfg = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || !isGuessing) return;
    onGuess(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-2xl bg-[oklch(0.7_0.18_260)]/10 px-4 py-3 border border-[oklch(0.7_0.18_260)]/20">
        <div className="h-3 w-3 animate-pulse rounded-full bg-[oklch(0.7_0.18_260)]" />
        <p className="text-base font-semibold">
          <span className="text-[oklch(0.55_0.18_260)] dark:text-[oklch(0.75_0.18_260)]">
            {drawerName}
          </span>{" "}
          is describing a word
        </p>
      </div>

      {/* Difficulty + Category hint */}
      {(diffCfg || category) && (
        <div className="flex flex-wrap items-center gap-2">
          {diffCfg && (
            <span
              className={`rounded-full border px-3 py-1 text-sm font-bold ${diffCfg.bg} ${diffCfg.border} ${diffCfg.color}`}
            >
              {diffCfg.label} · {pointValue ?? diffCfg.points} pts
            </span>
          )}
          {category && (
            <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-medium text-muted-foreground">
              {category}
            </span>
          )}
        </div>
      )}

      {/* Timer */}
      <GameTimer timer={timer} size="lg" className="w-full" />

      {/* Guess feed */}
      <div className="flex-1 rounded-2xl border bg-card p-1">
        <ScrollArea className="h-52">
          <div className="flex flex-col gap-2 p-3">
            {guesses.length === 0 ? (
              <p className="py-10 text-center text-base text-muted-foreground">
                No guesses yet — start guessing!
              </p>
            ) : (
              guesses.map((guess, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-base ${
                    guess.isCorrect
                      ? "bg-[oklch(0.75_0.18_150)]/15 border border-[oklch(0.75_0.18_150)]/30"
                      : "bg-muted/50"
                  }`}
                >
                  {guess.isCorrect ? (
                    <CheckCircle className="h-5 w-5 shrink-0 text-[oklch(0.6_0.18_150)]" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className="font-semibold">{guess.displayName}:</span>
                  <span
                    className={
                      guess.isCorrect
                        ? "font-bold text-[oklch(0.55_0.18_150)] dark:text-[oklch(0.75_0.18_150)]"
                        : ""
                    }
                  >
                    {guess.guess}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      {isGuessing && (
        <div className="flex gap-3">
          <Input
            placeholder="Type your guess..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
            className="h-14 text-lg"
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="h-14 w-14 shrink-0 bg-[oklch(0.7_0.18_260)] text-white hover:bg-[oklch(0.6_0.18_260)]"
            size="icon"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
