"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCircle, XCircle } from "lucide-react";
import { GameTimer } from "@/features/timer/components/GameTimer";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TimerState } from "@/features/timer/types";
import type { PictionaryGuess } from "../types";

interface GuesserViewProps {
  timer: TimerState;
  guesses: PictionaryGuess[];
  onGuess: (guess: string) => void;
  drawerName: string;
  isGuessing: boolean;
}

export function GuesserView({
  timer,
  guesses,
  onGuess,
  drawerName,
  isGuessing,
}: GuesserViewProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || !isGuessing) return;
    onGuess(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Badge variant="secondary" className="text-sm">
        {drawerName} is describing a word
      </Badge>

      <GameTimer timer={timer} size="lg" />

      <Card className="w-full max-w-md">
        <CardContent className="p-4">
          <ScrollArea className="h-48">
            <div className="flex flex-col gap-2">
              {guesses.map((guess, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm"
                >
                  {guess.isCorrect ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium">{guess.displayName}:</span>
                  <span className={guess.isCorrect ? "font-bold text-green-500" : ""}>
                    {guess.guess}
                  </span>
                </div>
              ))}
              {guesses.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No guesses yet. Start guessing!
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {isGuessing && (
        <div className="flex w-full max-w-md gap-2">
          <Input
            placeholder="Type your guess..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
          <Button onClick={handleSubmit} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
