"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { toast } from "sonner";

export default function CreateRoomPage() {
  const params = useParams<{ gameSlug: string }>();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    const name = displayName.trim();
    if (!name) {
      toast.error("Please enter your name");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameSlug: params.gameSlug,
          displayName: name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Store guest token if not authenticated
      if (data.player.guestToken) {
        localStorage.setItem("guest_token", data.player.guestToken);
      }
      localStorage.setItem("player_id", data.player.id);
      localStorage.setItem("display_name", name);

      router.push(ROUTES.ROOM(data.room.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create room");
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" render={<Link href={ROUTES.HOME} />}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>Create Game Room</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Your Name
            </label>
            <Input
              placeholder="Enter your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              maxLength={20}
              autoFocus
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={!displayName.trim() || isCreating}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Room"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
