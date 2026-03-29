"use client";

import { useCallback } from "react";
import { getRoomShareUrl } from "@/lib/room/code-generator";
import { toast } from "sonner";

export function useShareRoom(roomCode: string) {
  const shareUrl = getRoomShareUrl(roomCode);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  }, [shareUrl]);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      toast.success("Code copied to clipboard");
    } catch {
      toast.error("Failed to copy code");
    }
  }, [roomCode]);

  const shareViaSms = useCallback(
    (phoneNumber?: string) => {
      const body = encodeURIComponent(
        `Join my game! Use code ${roomCode} or click: ${shareUrl}`
      );
      const href = phoneNumber
        ? `sms:${phoneNumber}?body=${body}`
        : `sms:?body=${body}`;
      window.open(href, "_blank");
    },
    [roomCode, shareUrl]
  );

  const shareViaEmail = useCallback(
    (email?: string) => {
      const subject = encodeURIComponent("Join my game on Matrx Games!");
      const body = encodeURIComponent(
        `Join my game!\n\nUse code: ${roomCode}\nOr click this link: ${shareUrl}`
      );
      const href = email
        ? `mailto:${email}?subject=${subject}&body=${body}`
        : `mailto:?subject=${subject}&body=${body}`;
      window.open(href, "_blank");
    },
    [roomCode, shareUrl]
  );

  return { shareUrl, copyLink, copyCode, shareViaSms, shareViaEmail };
}
