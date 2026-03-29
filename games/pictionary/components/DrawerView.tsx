"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { GameTimer } from "@/features/timer/components/GameTimer";
import type { TimerState } from "@/features/timer/types";

interface DrawerViewProps {
  word: string;
  timer: TimerState;
  teamName: string;
}

export function DrawerView({ word, timer, teamName }: DrawerViewProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      <Badge variant="secondary" className="text-sm">
        <Pencil className="mr-1 h-3 w-3" />
        You are the drawer
      </Badge>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-muted-foreground text-sm">
            Your word is
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-4xl font-bold">{word}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Describe this to {teamName} without saying the word!
          </p>
        </CardContent>
      </Card>

      <GameTimer timer={timer} size="lg" />

      <p className="text-center text-sm text-muted-foreground">
        Your team is guessing...
      </p>
    </div>
  );
}
