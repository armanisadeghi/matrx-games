"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeDisplay({
  value,
  size = 200,
  className,
}: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setDataUrl);
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={cn("animate-pulse rounded-lg bg-muted", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt="QR Code"
      width={size}
      height={size}
      className={cn("rounded-lg", className)}
    />
  );
}
