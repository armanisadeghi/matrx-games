"use client";

import { useState } from "react";
import { Users, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Player } from "@/games/types";

interface TeamSelfAssignProps {
  players: Player[];
  currentPlayerId: string;
  onJoinTeam: (teamId: string) => Promise<void>;
  onLeaveTeam: () => Promise<void>;
}

export function TeamSelfAssign({
  players,
  currentPlayerId,
  onJoinTeam,
  onLeaveTeam,
}: TeamSelfAssignProps) {
  const [teamInput, setTeamInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const myTeam = currentPlayer?.teamId ?? null;

  // Build team map from all players who have a team
  const teamMap = new Map<string, Player[]>();
  for (const p of players) {
    if (p.teamId) {
      const existing = teamMap.get(p.teamId) ?? [];
      teamMap.set(p.teamId, [...existing, p]);
    }
  }
  const existingTeams = Array.from(teamMap.keys());

  const handleJoin = async (teamId: string) => {
    if (!teamId.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onJoinTeam(teamId.trim());
      setTeamInput("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onLeaveTeam();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
        Teams
      </p>

      {/* Existing teams */}
      {existingTeams.length > 0 && (
        <div className="flex flex-col gap-2">
          {existingTeams.map((teamId) => {
            const members = teamMap.get(teamId) ?? [];
            const isMyTeam = myTeam === teamId;
            return (
              <div
                key={teamId}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  isMyTeam
                    ? "border-[oklch(0.7_0.18_260)]/40 bg-[oklch(0.7_0.18_260)]/10"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{teamId}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {members.map((m) => m.displayName).join(", ")}
                    </p>
                  </div>
                </div>
                {isMyTeam ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLeave}
                    disabled={isSaving}
                    className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleJoin(teamId)}
                    disabled={isSaving}
                    className="ml-2 shrink-0"
                  >
                    Join
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / join new team */}
      {!myTeam && (
        <div className="flex gap-2">
          <Input
            placeholder="Team name..."
            value={teamInput}
            onChange={(e) => setTeamInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin(teamInput)}
            className="h-10"
          />
          <Button
            onClick={() => handleJoin(teamInput)}
            disabled={isSaving}
            size="sm"
            className="h-10 shrink-0"
          >
            <UserPlus className="mr-1 h-4 w-4" />
            Create
          </Button>
        </div>
      )}

      {myTeam && (
        <p className="text-center text-sm text-muted-foreground">
          You&apos;re on{" "}
          <span className="font-semibold text-foreground">{myTeam}</span> — tap
          X to switch
        </p>
      )}
    </div>
  );
}
