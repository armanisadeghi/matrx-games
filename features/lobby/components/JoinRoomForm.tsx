"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";

export function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return;
    setIsJoining(true);
    router.push(ROUTES.PLAY(trimmed));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join a Game</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            placeholder="Enter room code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="font-mono text-lg tracking-widest"
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          <Button onClick={handleJoin} disabled={code.length < 4 || isJoining}>
            {isJoining ? "Joining..." : "Join"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
