import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllGames } from "@/games/registry";
import { ROUTES } from "@/constants/routes";
import { JoinRoomForm } from "@/features/lobby/components/JoinRoomForm";

export default function HomePage() {
  const games = getAllGames();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Matrx Games</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="grid gap-8 md:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold">Play Together</h2>
              <p className="mt-1 text-muted-foreground">
                Real-time multiplayer games you can play with friends
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {games.map((game) => {
                const Icon = game.icon;
                return (
                  <Card key={game.slug} className="transition-colors hover:border-primary/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{game.name}</CardTitle>
                            <div className="mt-0.5 flex gap-1">
                              <Badge variant="outline" className="text-[10px]">
                                {game.minPlayers}-{game.maxPlayers} players
                              </Badge>
                              {game.supportsTeams && (
                                <Badge variant="outline" className="text-[10px]">
                                  Teams
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-3 text-sm">
                        {game.description}
                      </CardDescription>
                      <Button render={<Link href={ROUTES.ROOM_CREATE(game.slug)} />} size="sm" className="w-full">
                        Create Game
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <JoinRoomForm />
          </aside>
        </div>
      </main>

      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        Matrx Games
      </footer>
    </div>
  );
}
