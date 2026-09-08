"use client";

import { useSearchParams } from "next/navigation";
import { Button, Separator } from "@ai-matrx/design-system";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";

export function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Use your AI Matrx account to sign in
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <a
          href="/api/auth/aimatrx"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Continue with AI Matrx
        </a>

        <Separator />

        <p className="text-center text-xs text-muted-foreground">
          You can play games without signing in. Sign in is only needed
          for leaderboards and game history.
        </p>

        <Button asChild variant="ghost" className="w-full">
          <Link href={ROUTES.HOME}>Continue as Guest</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
