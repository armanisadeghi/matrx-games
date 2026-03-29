"use client";

import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShareDialog } from "@/features/sharing/components/ShareDialog";
import { toast } from "sonner";

interface RoomCodeDisplayProps {
  roomCode: string;
}

export function RoomCodeDisplay({ roomCode }: RoomCodeDisplayProps) {
  const [shareOpen, setShareOpen] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(roomCode);
    toast.success("Code copied");
  };

  return (
    <>
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm text-muted-foreground">Room Code</p>
            <p className="font-mono text-2xl font-bold tracking-widest">
              {roomCode}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={copyCode}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <ShareDialog
        roomCode={roomCode}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  );
}
