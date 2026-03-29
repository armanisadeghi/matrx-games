# CLAUDE.md -- Matrx Games

Web-based multiplayer game platform hosting 10-20+ games. Real-time multiplayer with team-based gameplay, synchronized timers, and role-based views. Supabase for database, auth, and realtime.

> **Official Next.js/React/TypeScript best practices:** `~/.arman/rules/nextjs-best-practices/nextjs-guide.md`

---

## Tech Stack

**Web:** Next.js 16.1 (App Router) + React 19.2 + TypeScript 5.9 (strict) + Tailwind CSS 4.1 (CSS-first)
**UI:** shadcn/ui + Radix UI + Lucide React (no emojis)
**State:** Zustand 5 for per-game client state
**Database:** Supabase (PostgreSQL + Auth + Realtime)
**Realtime:** Supabase Broadcast (ephemeral events) + Presence (room state) + Postgres Changes (persistent state)
**Deployment:** Vercel + Turbopack (default bundler)
**Package Manager:** pnpm

---

## File Organization

- **General dirs:** `/components`, `/hooks`, `/utils`, `/constants`, `/types`, `/providers`
- **Feature dirs:** `/features/[feature-name]/` containing: `index.ts`, `types.ts`, `components/`, `hooks/`
- **Game dirs:** `/games/[game-name]/` containing: `config.ts`, `components/`, `hooks/`, `state/`
- **Route example:** `app/room/[roomId]/play/page.tsx` renders game via registry

---

## Architecture

- `proxy.ts` handles auth session refresh (Next.js 16 pattern, replaces middleware.ts)
- Most routes are public (guest-friendly). Only `/dashboard`, `/profile`, `/history` require auth
- Guest mode: display name + `guest_token` (UUID in localStorage). No persistent stats
- Authenticated mode: Supabase Auth. Persistent leaderboards, game history, profile
- All `game_` prefixed tables coexist with other Supabase projects on the shared instance

**Supabase clients:**
- Client-side: `import { supabase } from "@/utils/supabase/client"`
- Server-side: `import { createClient } from "@/utils/supabase/server"`
- Admin: `import { createAdminClient } from "@/utils/supabase/adminClient"`

---

## Game Registry

Every game implements `GameDefinition` from `games/types.ts` and registers in `games/registry.ts`.
The `/room/[roomId]/play` page dynamically renders the game component from the registry.

To add a new game:
1. Copy `games/_template/` to `games/[new-game]/`
2. Implement `GameDefinition` in `config.ts`
3. Build game component implementing `GameComponentProps`
4. Register in `games/registry.ts`

---

## Realtime Patterns

- Per-room channel: `room:{roomId}`
- **Broadcast** for ephemeral events (timer sync, guesses, role changes)
- **Presence** for who's in the room
- **Postgres Changes** for persistent state (room status, player list)
- `GameRealtimeService` singleton manages channel lifecycle

---

## Core Principles

- Dynamic rendering by default
- Server Components by default; Client Components only for interactivity
- React Compiler enabled (`reactCompiler: true`) -- no manual `useMemo`/`useCallback`/`React.memo`
- TypeScript strict mode, no `any`
- Every async operation has structured error handling
- Mobile-responsive: `useIsMobile()` hook, Sheet instead of Dialog on mobile
- No `h-screen` or `vh` -- use `h-dvh` / `min-h-dvh`

---

## UI/UX Standards

- **Icons:** Lucide React only -- no emojis
- **Loading:** Use component library loading states
- **Dialogs:** Never use browser `alert()`/`confirm()`/`prompt()`
- **Mobile:** Sheet (bottom sheet) instead of Dialog via `useIsMobile()`

---

## Available Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm type-check   # TypeScript check
pnpm lint         # ESLint
pnpm types        # Generate Supabase types
```
