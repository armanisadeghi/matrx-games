"use client";

import { Copy, Mail, MessageSquare, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { QRCodeDisplay } from "./QRCodeDisplay";
import { useShareRoom } from "../hooks/useShareRoom";
import { getRoomShareUrl } from "@/lib/room/code-generator";

interface ShareDialogProps {
  roomCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({
  roomCode,
  open,
  onOpenChange,
}: ShareDialogProps) {
  const { copyLink, copyCode, shareViaSms, shareViaEmail } =
    useShareRoom(roomCode);
  const shareUrl = getRoomShareUrl(roomCode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Game Room</DialogTitle>
          <DialogDescription>
            Invite others to join your game
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Room Code</p>
            <button
              onClick={copyCode}
              className="mt-1 cursor-pointer rounded-lg bg-muted px-6 py-3 font-mono text-3xl font-bold tracking-widest transition-colors hover:bg-muted/80"
            >
              {roomCode}
            </button>
          </div>

          <Separator />

          <QRCodeDisplay value={shareUrl} size={180} />

          <Separator />

          <div className="flex w-full flex-col gap-2">
            <Button
              variant="outline"
              onClick={copyLink}
              className="w-full justify-start"
            >
              <Link2 className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
            <Button
              variant="outline"
              onClick={() => shareViaSms()}
              className="w-full justify-start"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Send via SMS
            </Button>
            <Button
              variant="outline"
              onClick={() => shareViaEmail()}
              className="w-full justify-start"
            >
              <Mail className="mr-2 h-4 w-4" />
              Send via Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
