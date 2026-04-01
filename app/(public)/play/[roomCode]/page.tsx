"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { ROUTES } from "@/constants/routes";
import { toast } from "sonner";

export default function JoinViaLinkPage() {
  const params = useParams<{ roomCode: string }>();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(
    () =>
      (typeof window !== "undefined"
        ? localStorage.getItem("display_name")
        : null) ?? "",
  );
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    const name = displayName.trim();
    if (name.length < 3) {
      toast.error("Name must be at least 3 characters");
      return;
    }

    setIsJoining(true);
    try {
      // Look up room by code
      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("id")
        .eq("room_code", params.roomCode.toUpperCase())
        .single();

      if (roomError || !room) {
        throw new Error("Room not found. Check the code and try again.");
      }

      // Join the room
      const res = await fetch(`/api/rooms/${room.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.player.guestToken) {
        localStorage.setItem("guest_token", data.player.guestToken);
      }
      localStorage.setItem("player_id", data.player.id);
      localStorage.setItem("display_name", name);

      router.push(ROUTES.ROOM(room.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join");
      setIsJoining(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join Game</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground">Room Code</p>
            <p className="font-mono text-2xl font-bold tracking-widest">
              {params.roomCode.toUpperCase()}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Your Name
            </label>
            <Input
              placeholder="Enter your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              maxLength={20}
              autoFocus
            />
          </div>
          <Button onClick={handleJoin} disabled={isJoining} className="w-full">
            {isJoining ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              "Join Game"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
