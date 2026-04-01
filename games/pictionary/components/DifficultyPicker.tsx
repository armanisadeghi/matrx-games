"use client";

import { Pencil, Star, Zap, Flame, Skull } from "lucide-react";
import { DIFFICULTY_CONFIG } from "../constants";
import type { PictionaryDifficultyLevel } from "../types";

const DIFFICULTIES: PictionaryDifficultyLevel[] = [
  "easy",
  "medium",
  "hard",
  "very_hard",
  "extra_challenge",
];

const ICONS = {
  easy:            <Star className="h-6 w-6" />,
  medium:          <Pencil className="h-6 w-6" />,
  hard:            <Flame className="h-6 w-6" />,
  very_hard:       <Zap className="h-6 w-6" />,
  extra_challenge: <Skull className="h-6 w-6" />,
};

interface DifficultyPickerProps {
  isDrawer: boolean;
  drawerName: string;
  roundNumber: number;
  teamName: string;
  onPick: (difficulty: PictionaryDifficultyLevel) => void;
}

export function DifficultyPicker({
  isDrawer,
  drawerName,
  roundNumber,
  teamName,
  onPick,
}: DifficultyPickerProps) {
  if (!isDrawer) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Round {roundNumber} — Team {teamName}
          </p>
          <h2 className="text-3xl font-bold">
            {drawerName} is choosing...
          </h2>
          <p className="text-lg text-muted-foreground">
            Wait while the drawer picks a difficulty level
          </p>
        </div>

        <div className="grid w-full max-w-sm gap-3">
          {DIFFICULTIES.map((diff) => {
            const cfg = DIFFICULTY_CONFIG[diff];
            return (
              <div
                key={diff}
                className={`flex items-center justify-between rounded-xl border px-5 py-4 opacity-40 ${cfg.bg} ${cfg.border}`}
              >
                <div className="flex items-center gap-3">
                  <span className={cfg.color}>{ICONS[diff]}</span>
                  <span className="text-lg font-semibold">{cfg.label}</span>
                </div>
                <span className={`text-base font-bold ${cfg.color}`}>
                  {cfg.points} pts
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Round {roundNumber} — Team {teamName}
        </p>
        <h2 className="text-3xl font-bold">Pick your difficulty</h2>
        <p className="text-lg text-muted-foreground">
          Higher difficulty = more points, harder to draw
        </p>
      </div>

      <div className="grid w-full max-w-sm gap-3">
        {DIFFICULTIES.map((diff) => {
          const cfg = DIFFICULTY_CONFIG[diff];
          return (
            <button
              key={diff}
              onClick={() => onPick(diff)}
              className={`flex cursor-pointer items-center justify-between rounded-xl border px-5 py-4 transition-all active:scale-95 hover:scale-[1.02] ${cfg.bg} ${cfg.border} hover:brightness-110`}
            >
              <div className="flex items-center gap-3">
                <span className={cfg.color}>{ICONS[diff]}</span>
                <div className="flex flex-col items-start">
                  <span className="text-lg font-bold">{cfg.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {diff === "easy" && "Simple objects, quick draws"}
                    {diff === "medium" && "Scenes and actions"}
                    {diff === "hard" && "Abstract ideas"}
                    {diff === "very_hard" && "Tough concepts"}
                    {diff === "extra_challenge" && "Nearly impossible"}
                  </span>
                </div>
              </div>
              <span className={`text-xl font-black ${cfg.color}`}>
                {cfg.points}
                <span className="text-sm font-medium"> pts</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
