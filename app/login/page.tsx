import { Suspense } from "react";
import { Gamepad2 } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Gamepad2 className="h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">Matrx Games</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to track your scores and leaderboard rankings
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
