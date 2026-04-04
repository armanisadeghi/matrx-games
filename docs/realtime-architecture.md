# Matrx Games — Realtime Architecture

> **Status:** Final design. Approved for implementation.
> **Scope:** All current and future games on this platform.
> **Goal:** A single, reliable, game-agnostic realtime system that any game can plug into — once.

---

## Guiding Principle

**The database is always right. Every client always agrees with the database.**

Every state transition writes to the database first. The database then pushes that change to every connected client automatically via Postgres Changes subscriptions. A client that missed a broadcast, reconnected, rejoined, or just opened the app — they all read the same DB row and arrive at the same state.

Supabase Broadcast is used only as a performance optimization (sub-50ms delivery on the happy path). It is never the only path. If a broadcast is missed, the Postgres Changes subscription delivers the same update within 100–300ms. The game continues correctly regardless.

---

## Schema Overview

Five tables power the entire platform across all games. The design is intentionally generic: the platform manages lifecycle, turns, scoring, timers, and events. Each individual game only needs to supply its `game_data` JSONB blob and define which events it produces.

```
game_registry        — static metadata about each game (slug, rules, phase config)
game_rooms           — one row per room; lobby status and settings
game_players         — one row per player per room; roles, teams, scores
game_state           — one row per active room; the complete live state snapshot
game_events          — append-only log of all player actions
```

---

## Table 1: `game_registry`

Static configuration for every game on the platform. Enables structural validation, game browser UI, and platform-level logic without hardcoding anything.

```sql
create table game_registry (
  game_slug           text primary key,
  display_name        text not null,
  description         text,
  icon_name           text,                -- Lucide icon name

  -- Player counts
  min_players         integer not null default 2,
  max_players         integer not null default 20,

  -- Team config
  supports_teams      boolean not null default false,
  min_teams           integer,
  max_teams           integer,
  min_per_team        integer,
  max_per_team        integer,

  -- Role config
  has_persistent_roles boolean not null default false,
  -- persistent = assigned at game start and kept all game (Werewolf, Codenames)
  -- non-persistent = rotated each round (Pictionary)
  has_hidden_roles    boolean not null default false,
  -- hidden = other players must not see role (Werewolf, Secret Hitler)

  -- Scoring model
  scoring_model       text not null default 'cumulative',
  -- 'cumulative'  — running total of points (Pictionary, Trivia)
  -- 'lives'       — players are eliminated when lives reach 0
  -- 'elimination' — players are voted/knocked out (Werewolf, Battle Royale)
  -- 'resource'    — multiple tracked resources per player (money, territory, cards)
  -- 'custom'      — game defines its own model entirely in game_data

  -- Actor model
  actor_model         text not null default 'single',
  -- 'single'       — one actor at a time (Pictionary)
  -- 'team_single'  — one actor per team simultaneously (Pictionary with parallel teams)
  -- 'simultaneous' — all players act at once (party trivia)
  -- 'role_based'   — specific roles act in specific phases (Werewolf night)
  -- 'free'         — any player can act at any time (sandbox/cooperative)

  -- Phase definitions (ordered; platform advances current_phase_index through this list)
  phase_sequence      jsonb not null default '[]',
  -- Each entry: { "name": "drawing", "timer_ms": 60000, "active_roles": ["drawer"],
  --               "advance_on": "timer_end | correct_event | host_action | all_acted" }

  -- Default settings (copied to game_rooms.settings on room creation)
  default_settings    jsonb not null default '{}',

  -- Valid event_type values this game can produce (for validation)
  event_types         jsonb not null default '[]',

  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);
```

---

## Table 2: `game_rooms`

Unchanged from current design. One row per room. Tracks lifecycle status and settings.

```sql
-- Existing table — no structural changes needed.
-- game_rooms.status drives lobby → play navigation via Postgres Changes.
-- Values: 'waiting' | 'starting' | 'playing' | 'paused' | 'finished' | 'abandoned'
```

---

## Table 3: `game_players`

Extended to support persistent roles, hidden information, and per-player live state.

```sql
-- Additions to existing game_players table:

alter table game_players add column if not exists
  game_role           text;
  -- Assigned at game start for persistent-role games.
  -- Null for games without persistent roles, or for non-persistent phases.
  -- Examples: 'werewolf', 'seer', 'doctor', 'spymaster', 'operative'

alter table game_players add column if not exists
  game_role_data      jsonb default '{}';
  -- Private data only this player and the host should see.
  -- Examples for Werewolf: { "knows_werewolves": ["player_id_2", "player_id_5"] }
  -- Examples for Poker:    { "hand": ["Ac", "Kd"] }
  -- RLS filters this column for hidden-role games (see policies below).

alter table game_players add column if not exists
  player_state        jsonb default '{}';
  -- Per-player live state beyond a simple score integer.
  -- Updated by host on relevant game events.
  -- Examples:
  --   Simple:   { "score": 150, "streak": 3 }
  --   Lives:    { "score": 0, "lives": 2, "status": "alive" }
  --   Resource: { "money": 500, "territories": 3, "cards_in_hand": 5 }
  --   Werewolf: { "status": "alive", "votes_received": 2 }

alter table game_players add column if not exists
  is_eliminated       boolean not null default false;

alter table game_players add column if not exists
  eliminated_at       timestamptz;

alter table game_players add column if not exists
  elimination_reason  text;
  -- 'voted_out' | 'killed' | 'timed_out' | 'disconnected' | 'forfeit'

-- Updated RLS for hidden roles
-- Players always see their own row in full.
-- For other players: game_role and game_role_data are nulled out when
-- the game has hidden_roles = true and the game is still active.
create or replace function public.strip_hidden_role_data(p game_players)
returns game_players language plpgsql security definer as $$
declare
  is_hidden boolean;
  is_own_row boolean;
begin
  is_own_row := (p.user_id = auth.uid());
  if is_own_row then
    return p;
  end if;

  select gr.has_hidden_roles into is_hidden
  from game_state gs
  join game_registry gr on gr.game_slug = gs.game_slug
  where gs.room_id = p.room_id
    and gs.phase not in ('game_over', 'finished');

  if is_hidden then
    p.game_role := null;
    p.game_role_data := null;
  end if;
  return p;
end;
$$;
```

---

## Table 4: `game_state`

The authoritative, complete snapshot of the live game. One row per room. Everything every client needs to render the current state correctly.

```sql
create table game_state (
  -- ── Identity ────────────────────────────────────────────────────────────────
  room_id             uuid primary key references game_rooms(id) on delete cascade,
  game_slug           text not null references game_registry(game_slug),

  -- ── Sequence & timestamps ────────────────────────────────────────────────────
  seq                 bigint not null default 0,
  -- Monotonically increasing on every write. Clients detect missed updates
  -- when seq > local_seq + 1 and re-fetch the full row.

  updated_at          timestamptz not null default now(),
  phase_entered_at    timestamptz,

  -- ── Lifecycle phase ──────────────────────────────────────────────────────────
  phase               text not null default 'waiting',
  -- Platform phases: waiting | starting | playing | paused | round_end | game_over
  --                  finished | abandoned
  -- Game-specific sub-phases are also stored here as plain strings.
  -- Examples: 'picking_difficulty', 'previewing', 'drawing', 'day_vote', 'night_seer'

  -- ── Round / turn structure ───────────────────────────────────────────────────
  current_round       integer not null default 0,
  total_rounds        integer not null default 0,
  -- total_rounds is locked when the game starts; never recomputed mid-game.

  current_phase_index integer not null default 0,
  -- Index into game_registry.phase_sequence for the current phase.
  -- Platform increments this; each game defines the sequence.
  -- Example for Werewolf: 0=day_discussion, 1=day_vote, 2=day_elimination,
  --                       3=night_seer, 4=night_doctor, 5=night_werewolf

  current_sub_turn    integer not null default 0,
  -- Sub-action counter within the current phase.
  -- Examples: guess count within a Codenames clue, card play within a trick.

  -- ── Active players ──────────────────────────────────────────────────────────
  -- Replaces the single current_actor_id + current_team_id pattern.
  -- Supports single-actor, simultaneous, team-parallel, and role-scoped models.
  active_players      jsonb not null default '[]',
  -- Array of objects:
  -- [
  --   {
  --     "player_id": "uuid",
  --     "team_id": "Team A",          -- which team this actor belongs to
  --     "role_in_phase": "drawer",    -- what this player is doing right now
  --     "has_acted": false            -- for simultaneous phases: has this player submitted?
  --   }
  -- ]
  --
  -- Pictionary (single):   [{ player_id, team_id, role_in_phase: "drawer" }]
  -- Trivia (all guess):    [{ player_id, team_id, role_in_phase: "guesser" }, ...all players]
  -- Codenames (spymasters act):
  --   [{ player_id: red_spymaster, role_in_phase: "spymaster" },
  --    { player_id: blue_spymaster, role_in_phase: "spymaster" }]
  -- Werewolf night:        [{ player_id: seer_id, role_in_phase: "seer" }]

  -- ── Timer ────────────────────────────────────────────────────────────────────
  -- Clients compute: remaining = timer_duration_ms - (Date.now() - timer_started_at_ms)
  -- No timer:sync broadcasts ever needed.
  timer_started_at    timestamptz,
  -- null = no timer running; set = timer is counting down from this moment

  timer_duration_ms   integer,
  -- Copied from settings_snapshot on round start; reflects the actual duration for THIS round.
  -- Can vary per phase (e.g. day_discussion = 120s, day_vote = 30s).

  timer_paused_at     timestamptz,
  -- null = running; set = paused at this exact moment
  -- Clients adjust: remaining = timer_duration_ms - (paused_at - timer_started_at)

  -- ── Scores & player states ───────────────────────────────────────────────────
  -- Flexible: each game defines the shape of each player/team state object.
  -- Platform utilities provide helpers for common operations (increment, eliminate, etc.)
  player_states       jsonb not null default '{}',
  -- { "player_uuid": { "score": 150, "lives": 3, "status": "alive", "streak": 2, ... } }

  team_states         jsonb not null default '{}',
  -- { "team_name": { "score": 450, "territories": 7, ... } }

  -- ── Round result ─────────────────────────────────────────────────────────────
  -- Null until round ends. Shape is game-defined.
  round_result        jsonb,
  -- Pictionary: { "winner_player_id": "uuid", "winner_team_id": "...", "points_awarded": 200 }
  -- Trivia:     { "correct_players": ["uuid1", "uuid2"], "points_each": 100 }
  -- Werewolf:   { "eliminated_player_id": "uuid", "elimination_type": "vote", "was_werewolf": true }
  -- Codenames:  { "cards_revealed": 2, "hit_assassin": false, "team_id": "red" }
  -- No winner:  null  (timer ran out with no correct answer)

  -- ── Private data ─────────────────────────────────────────────────────────────
  -- Information that only specific players (or the host) should see.
  -- Access control is enforced at the DB level via the read function below.
  private_data        jsonb not null default '{}',
  -- Keyed by player_id or by role name:
  -- {
  --   "player_uuid_1":          { "hand": ["Ac", "Kd"] },        -- poker hand
  --   "role:spymaster:red":     { "key_card": [...25 entries] }, -- codenames key card
  --   "role:werewolf":          { "teammates": ["uuid2","uuid3"] } -- who the wolves know
  -- }
  --
  -- A Postgres function strips keys the requesting player is not entitled to see
  -- before the row is returned. See: filtered_game_state() below.

  -- ── Game-specific public state ───────────────────────────────────────────────
  -- Everything game-specific that ALL players can see.
  game_data           jsonb not null default '{}',
  -- Pictionary:
  --   { "word_category": "Animals", "word_difficulty": "medium",
  --     "point_value": 100, "used_word_ids": [],
  --     "warning_at": "iso-timestamp",       ← alarm fires when clients see this set
  --     "final_warning_at": "iso-timestamp"  ← buzzer fires when clients see this set
  --   }
  --   NOTE: "word" is in private_data keyed by drawer's player_id, not here.
  --
  -- Trivia:
  --   { "question_text": "...", "category": "...", "answer_revealed": false,
  --     "buzz_order": ["uuid1"], "point_value": 100 }
  --   NOTE: "correct_answer" is in private_data keyed by "role:host".
  --
  -- Codenames:
  --   { "board": [...25 words with team + revealed status], "clue": null,
  --     "clue_count": null, "guesses_remaining": 0, "red_remaining": 8, "blue_remaining": 8 }
  --   NOTE: key_card is in private_data keyed by "role:spymaster:red" and "role:spymaster:blue".

  -- ── Settings snapshot ────────────────────────────────────────────────────────
  -- Frozen copy of game_rooms.settings at game start.
  -- Immutable once the game starts — clients and host always agree on rules.
  settings_snapshot   jsonb not null default '{}',
  -- Platform fields:
  -- {
  --   "timer_duration_ms": 60000,           ← base round timer
  --   "preview_duration_ms": 10000,         ← pre-round preview (if applicable)
  --   "heartbeat_interval_pct": 25,         ← heartbeat every N% of timer
  --   "warning_threshold_ms": 10000,        ← alarm at T-10s
  --   "final_warning_threshold_ms": 5000,   ← buzzer at T-5s
  --   "rounds_per_team": 3,
  --   "max_players": 20
  --   ... plus all game-specific settings
  -- }

  -- ── Host tracking ────────────────────────────────────────────────────────────
  host_player_id      uuid references game_players(id)
  -- The player who can write to this row.
  -- Updated when host disconnects and a new host is promoted.
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index game_state_room_idx   on game_state(room_id);
create index game_state_phase_idx  on game_state(room_id, phase);
create index game_state_seq_idx    on game_state(room_id, seq);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table game_state enable row level security;

-- Read: any player in the room (private_data is filtered by application function)
create policy "room members can read game state"
  on game_state for select
  using (
    exists (
      select 1 from game_players gp
      where gp.room_id = game_state.room_id
        and gp.left_at is null
        and (gp.user_id = auth.uid() or gp.guest_token is not null)
    )
  );

-- Insert: only the host player (room creator)
create policy "host can insert game state"
  on game_state for insert
  with check (
    exists (
      select 1 from game_players gp
      where gp.room_id = game_state.room_id
        and gp.role = 'host'
        and (gp.user_id = auth.uid() or gp.guest_token is not null)
    )
  );

-- Update: only the current host_player_id
create policy "only host can update game state"
  on game_state for update
  using (
    exists (
      select 1 from game_players gp
      where gp.id = game_state.host_player_id
        and (gp.user_id = auth.uid() or gp.guest_token is not null)
    )
  );
```

### Private data filtering function

This function is called by the application (not enforced at the SELECT level, because column-level RLS doesn't exist in Postgres) to strip `private_data` keys the requesting player should not see.

```sql
create or replace function public.get_game_state_for_player(
  p_room_id   uuid,
  p_player_id uuid
)
returns game_state
language plpgsql security definer
as $$
declare
  gs         game_state;
  gr         game_registry;
  gp         game_players;
  visible    jsonb := '{}';
  key        text;
  val        jsonb;
  player_role text;
begin
  select * into gs from game_state where room_id = p_room_id;
  if not found then return null; end if;

  select * into gr from game_registry where game_slug = gs.game_slug;
  select game_role into player_role from game_players where id = p_player_id;

  -- Build visible private_data: include keys this player is entitled to
  for key, val in select * from jsonb_each(gs.private_data) loop
    -- Always include own player_id key
    if key = p_player_id::text then
      visible := visible || jsonb_build_object(key, val);

    -- Include role-keyed data if player holds that role
    elsif key like 'role:%' and player_role is not null then
      -- e.g. 'role:spymaster:red' is visible to player with game_role = 'spymaster' on team 'red'
      if key = 'role:' || player_role then
        visible := visible || jsonb_build_object(key, val);
      end if;
    end if;
  end loop;

  -- Hosts see everything (for evaluation logic)
  if exists (
    select 1 from game_players
    where id = p_player_id and role = 'host'
  ) then
    visible := gs.private_data;
  end if;

  gs.private_data := visible;
  return gs;
end;
$$;
```

---

## Table 5: `game_events`

Append-only log of all player actions. Players write directly; host evaluates. Postgres Changes on this table replaces all `guess:submit`, `buzz`, `vote`, and `answer` broadcast patterns.

```sql
create table game_events (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references game_rooms(id) on delete cascade,
  game_slug       text not null,

  -- Context
  seq             bigint not null,
  -- game_state.seq at the moment of insertion — links event to the exact state snapshot
  round_number    integer not null,
  phase_index     integer not null default 0,
  sub_turn        integer not null default 0,

  -- Author
  player_id       uuid not null references game_players(id),
  display_name    text not null,
  team_id         text,
  game_role       text,

  -- Event classification
  event_type      text not null,
  -- Platform types (all games):
  --   'guess'    — text guess (Pictionary, word games)
  --   'answer'   — explicit answer submission (Trivia)
  --   'buzz'     — first-to-answer buzz (Quiz games)
  --   'vote'     — player vote (reset, skip, kick, role-action)
  --   'action'   — game-specific role action (Werewolf seer look, Doctor protect)
  --   'chat'     — in-game chat message
  --   'react'    — emoji reaction (visual only, no evaluation)
  --   'system'   — platform-generated event (host change, timer warning, etc.)

  -- Event payload (game-specific structure)
  event_data      jsonb not null default '{}',
  -- 'guess':   { "text": "elephant" }
  -- 'answer':  { "text": "Paris", "buzz_position": 1 }
  -- 'buzz':    { "latency_ms": 234 }
  -- 'vote':    { "vote_type": "reset|skip|kick|role", "target_player_id": "uuid" }
  -- 'action':  { "action_type": "seer_look|protect|kill", "target_player_id": "uuid" }
  -- 'chat':    { "message": "nice one!" }
  -- 'react':   { "emoji": "🔥", "target_event_id": "uuid" }
  -- 'system':  { "message": "Host transferred to Player 2" }

  -- Result (set by host after evaluation)
  is_evaluated    boolean not null default false,
  is_accepted     boolean,
  -- null = pending, true = correct/accepted/approved, false = wrong/rejected

  result_data     jsonb,
  -- Optional additional result metadata:
  -- { "points_awarded": 200, "correct_answer": "elephant", "rank": 1 }

  -- Visibility
  is_public       boolean not null default true,
  -- false = private event, only visible to the target player and host
  -- Used for: role actions in Werewolf, private cards in poker, etc.

  target_player_id uuid references game_players(id),
  -- For targeted private events (e.g., Seer looks at a specific player)

  created_at      timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index game_events_room_round_idx  on game_events(room_id, round_number);
create index game_events_room_type_idx   on game_events(room_id, event_type, created_at);
create index game_events_player_idx      on game_events(player_id, created_at);
create index game_events_seq_idx         on game_events(room_id, seq);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table game_events enable row level security;

-- Public events: all players in the room can read
create policy "room members can read public events"
  on game_events for select
  using (
    is_public = true
    and exists (
      select 1 from game_players gp
      where gp.room_id = game_events.room_id and gp.left_at is null
    )
  );

-- Private events: only the authoring player, the target player, and the host
create policy "private events visible to author, target, and host"
  on game_events for select
  using (
    is_public = false
    and exists (
      select 1 from game_players gp
      where gp.room_id = game_events.room_id
        and gp.left_at is null
        and (
          gp.id = game_events.player_id        -- authored by me
          or gp.id = game_events.target_player_id  -- targeted at me
          or gp.role = 'host'                  -- I am the host
        )
    )
  );

-- Insert: any active player can insert their own events
create policy "players can insert own events"
  on game_events for insert
  with check (
    player_id in (
      select id from game_players
      where room_id = game_events.room_id and left_at is null
    )
  );

-- Update: only host can evaluate (set is_evaluated, is_accepted, result_data)
create policy "host can evaluate events"
  on game_events for update
  using (
    exists (
      select 1 from game_state gs
      join game_players gp on gp.id = gs.host_player_id
      where gs.room_id = game_events.room_id
        and (gp.user_id = auth.uid() or gp.guest_token is not null)
    )
  );
```

---

## Complete Event Inventory

Every moment where all clients must agree on state, in chronological order.

---

### TIER 1 — PARTICIPANT EVENTS (always active, any time)

| # | Event | Who triggers | DB Write | What everyone learns |
|---|---|---|---|---|
| P1 | **Player joins room** | Joining client → API | `game_players` INSERT | Player list updates |
| P2 | **Player sets display name** | Player | `game_players.display_name` UPDATE | Name appears everywhere |
| P3 | **Player joins a team** | Player | `game_players.team_id` UPDATE | Team roster updates |
| P4 | **Player leaves a team** | Player | `game_players.team_id = null` | Team roster updates |
| P5 | **Player reconnects** | Client connects | `game_players.is_connected = true` | Online indicator updates |
| P6 | **Player disconnects** | Presence timeout | `game_players.is_connected = false` | Online indicator; host may auto-skip turn |
| P7 | **Player leaves room** | Navigate away or explicit leave | `game_players.left_at = now()` | Removed from roster; if active actor, host skips |
| P8 | **Player rejoins mid-game** | Rejoin API | `game_players.left_at = null` | Reappears; reads `game_state` to catch up instantly |
| P9 | **Host transfers** | Host or auto-promotion on disconnect | `game_players.role` UPDATE (both old + new host); `game_state.host_player_id` UPDATE | New host can write game state |
| P10 | **Player eliminated** | Host | `game_players.is_eliminated = true`, `eliminated_at`, `elimination_reason`; `game_state.player_states` updated | Player marked out; UI updates for all |

---

### TIER 2 — LOBBY / PRE-GAME EVENTS

| # | Event | Who triggers | DB Write | What everyone learns |
|---|---|---|---|---|
| L1 | **Room created** | Host → API | `game_rooms` INSERT | Room exists; QR/code generated |
| L2 | **Settings changed** | Host | `game_rooms.settings` UPDATE | All lobby clients see new settings live |
| L3 | **Roles assigned** *(persistent-role games)* | Host | `game_players.game_role` UPDATE for all players; `game_players.game_role_data` UPDATE for role-specific private info | Role assignments visible to each player (filtered by RLS) |
| L4 | **Game countdown started** | Host | `game_rooms.status = 'starting'`; `game_state` INSERT: `phase = 'starting'`, `settings_snapshot` copied, `total_rounds` locked | Join window closes; countdown begins |
| L5 | **Game starts** | Host | `game_rooms.status = 'playing'`; `game_rooms.started_at`; `game_state` UPSERT: `phase` = first active phase, `current_round = 1`, `active_players`, `total_rounds`, `host_player_id`, `seq = 1` | **All non-host clients navigate to play page** (via Postgres Changes on `game_rooms.status`) |

---

### TIER 3 — ROUND LIFECYCLE EVENTS

These repeat for every round.

| # | Event | Who triggers | DB Write | What everyone learns |
|---|---|---|---|---|
| R1 | **Round / turn starts** | Host | `game_state` UPSERT: `phase`, `current_round`, `current_phase_index`, `current_sub_turn = 0`, `active_players`, `round_result = null`, `game_data` (word cleared, etc.), `phase_entered_at`, `seq++` | Everyone knows whose turn it is |
| R2 | **Active player performs action** | Active player(s) | `game_state` UPSERT: `game_data` updated + `phase` advanced + `active_players` possibly updated, `seq++` | Phase advances; everyone sees new state |
| R3 | **Preview phase starts** *(games with pre-round preview)* | Active player | `game_state` UPSERT: `phase = 'previewing'`, `phase_entered_at`, `game_data.preview_started_at`, `seq++` | All clients show preview countdown |
| R4 | **Timer starts** | Active player (writes after preview) | `game_state` UPSERT: `phase` = active phase, `timer_started_at`, `timer_duration_ms`, `phase_entered_at = timer_started_at`, `seq++` | **All clients derive countdown from `timer_started_at`** — no sync broadcasts |
| R5 | **Heartbeat: 75% remaining** | Host interval | `game_state` UPSERT: `seq++` only | Clients compare seq; out-of-sync clients re-fetch |
| R6 | **Heartbeat: 50% remaining** | Host interval | `game_state` UPSERT: `seq++` only | Same |
| R7 | **Heartbeat: 25% remaining** | Host interval | `game_state` UPSERT: `seq++` only | Same |
| R8 | **10-second warning** | Host interval at `T₀ + (D - warning_ms)` | `game_state` UPSERT: `game_data.warning_at = now()`, `seq++` | All clients fire alarm UI at the same absolute timestamp |
| R9 | **5-second warning** | Host interval at `T₀ + (D - final_warning_ms)` | `game_state` UPSERT: `game_data.final_warning_at = now()`, `seq++` | All buzzers fire together |
| R10 | **Timer expires — no result** | Host (onComplete callback) | `game_state` UPSERT: `phase = 'round_end'`, `timer_started_at = null`, `timer_paused_at = null`, `round_result = null`, `seq++` | Round ends with no winner |
| R11 | **Round resolved — winner** | Host (evaluates `game_events`) | `game_state` UPSERT: `phase = 'round_end'`, `timer_started_at = null`, `round_result`, `player_states`, `team_states`, `seq++`; `game_events` UPDATE: `is_evaluated`, `is_accepted`, `result_data` | Scores update; winner shown |
| R12 | **Phase advanced within a round** | Host | `game_state` UPSERT: `current_phase_index++`, `phase` = next phase name, `active_players` updated for new phase, `timer` set if new phase has one, `seq++` | Sub-phase transitions (e.g., day_discussion → day_vote) |
| R13 | **Sub-turn advanced** | Host | `game_state` UPSERT: `current_sub_turn++`, `active_players` updated if needed, `seq++` | Next action within a phase (e.g., next guess in Codenames) |
| R14 | **Actor skipped** | Actor requests skip, or host skips them | `game_state` UPSERT: `active_players` updated to next actor (same round/phase), `seq++` | Actor changes; everyone sees new actor |
| R15 | **Round results acknowledged** | Host | Triggers R1 for next round | Next round begins |

---

### TIER 4 — PLAYER INPUT EVENTS (written to `game_events`)

Players write directly. Host subscribes via Postgres Changes and evaluates.

| # | Event | Written by | `event_type` | Visibility | What happens next |
|---|---|---|---|---|---|
| E1 | **Guess** (Pictionary) | Any guesser | `'guess'` | public | Host evaluates → R11 if correct |
| E2 | **Buzz in** (Quiz) | Any player | `'buzz'` | public | Host grants answer right to first timestamp |
| E3 | **Answer** (Trivia) | Answering player | `'answer'` | public | Host evaluates correctness → R11 |
| E4 | **Vote** (reset/skip/kick/role action) | Any player | `'vote'` | public | Host counts; on threshold met → triggers action |
| E5 | **Role action** (Werewolf night) | Role player | `'action'` | private | `is_public = false`; only host + target see it; host applies result |
| E6 | **Chat message** | Any player | `'chat'` | public | All clients display; no evaluation needed |
| E7 | **Emoji reaction** | Any player | `'react'` | public | Visual only; no game state change |
| E8 | **System event** | Platform | `'system'` | public | Informational (host changed, player rejoined, etc.) |

---

### TIER 5 — GAME LIFECYCLE EVENTS

| # | Event | Who triggers | DB Write | What everyone learns |
|---|---|---|---|---|
| G1 | **Game over** | Host (final round resolved) | `game_state` UPSERT: `phase = 'game_over'`, `seq++`; `game_rooms.status = 'finished'`, `finished_at = now()` | Final scores; game over screen |
| G2 | **Rematch** | Host | `game_rooms.status = 'waiting'`; `game_state` full reset to initial values, `seq = 0` | Everyone returns to lobby |
| G3 | **Game abandoned** | Host or timeout | `game_rooms.status = 'abandoned'`; `game_state.phase = 'abandoned'` | Room closes; players redirected |
| G4 | **Emergency reset — current round** | Vote threshold met → host | `game_state` UPSERT: rolled back to R1 for current round, scores preserved, `seq++` | Current round restarts |
| G5 | **Emergency reset — full game** | Host | `game_state` full reset, `game_rooms.status = 'waiting'`, `seq = 0` | Full restart; return to lobby |

---

### TIER 6 — SYSTEM / PLATFORM EVENTS

| # | Event | Who triggers | DB Write | What everyone learns |
|---|---|---|---|---|
| S1 | **Heartbeat** *(timer-driven, see Tier 3)* | Host | `game_state.seq++` | Seq-drift clients re-fetch full state |
| S2 | **State re-sync** | Any client → Broadcast `state:request` | No DB write; host re-broadcasts full snapshot | Fast-path catch-up for reconnecting client |
| S3 | **Host promoted** | Auto on host disconnect | `game_state.host_player_id` UPDATE; `game_players.role` UPDATE | New host takes control |
| S4 | **Game paused** | Host | `game_rooms.status = 'paused'`; `game_state.timer_paused_at = now()`, `seq++` | All clients freeze timer and show pause overlay |
| S5 | **Game resumed** | Host | `game_rooms.status = 'playing'`; `game_state.timer_started_at` adjusted for paused duration, `timer_paused_at = null`, `seq++` | All clients resume timer from correct point |

---

## Timer Architecture

### Core principle

Store one value: `timer_started_at` (a UTC timestamp). Every client computes remaining time independently:

```
remaining_ms = Math.max(0, timer_duration_ms - (Date.now() - timer_started_at_ms))
```

This is correct:
- On initial render
- After reconnect or rejoin (read from DB, compute fresh)
- After tab switch or phone sleep
- On different devices with slightly different clocks (±500ms drift is imperceptible for party games)

No `timer:sync` broadcasts. No drift accumulation. No recovery logic needed.

### Pause/resume

```
When paused:
  remaining = timer_duration_ms - (timer_paused_at - timer_started_at)
  — both values are in game_state, so all clients agree

When resumed:
  new timer_started_at = now() - (timer_duration_ms - remaining_at_pause_time)
  — adjust start time so the countdown continues from where it paused
  — write new timer_started_at, clear timer_paused_at
```

### Heartbeat schedule

```
For a round with duration D and configured thresholds:

  T₀ + 0ms              → R4:  timer_started_at written, phase advances to active phase
  T₀ + (D × 0.25)       → R5:  seq++ heartbeat
  T₀ + (D × 0.50)       → R6:  seq++ heartbeat
  T₀ + (D × 0.75)       → R7:  seq++ heartbeat
  T₀ + (D − warning_ms) → R8:  game_data.warning_at = now()  [default: D − 10000ms]
  T₀ + (D − final_ms)   → R9:  game_data.final_warning_at = now()  [default: D − 5000ms]
  T₀ + D                → R10: timer_started_at = null, phase = 'round_end'
```

All thresholds are configurable per game per phase in `settings_snapshot`.

### Timer settings (in `settings_snapshot`)

```jsonc
{
  "timer_duration_ms": 60000,
  "preview_duration_ms": 10000,
  "heartbeat_interval_pct": 25,
  "warning_threshold_ms": 10000,
  "final_warning_threshold_ms": 5000,
  // Phase-specific overrides (Werewolf example):
  "phase_timers": {
    "day_discussion": 120000,
    "day_vote": 30000,
    "night_seer": 15000,
    "night_doctor": 15000,
    "night_werewolf": 20000
  }
}
```

---

## Client Subscription Model

Every client subscribes to exactly these channels. Nothing more.

### Lobby page (`/room/[roomId]`)

```
Postgres Changes → game_rooms WHERE id = $roomId
  on UPDATE.status = 'playing' or 'starting' → navigate to play page
  on UPDATE.settings → update settings display

Postgres Changes → game_players WHERE room_id = $roomId
  on INSERT → add to player list
  on UPDATE → update player data (team, name, connection, role)

Supabase Presence → channel: room:{roomId}
  on sync/join/leave → update online indicators (display only)
```

### Play page (`/room/[roomId]/play`)

```
Postgres Changes → game_state WHERE room_id = $roomId
  on UPDATE:
    1. Check seq:
       - seq == local_seq + 1   → apply normally
       - seq > local_seq + 1    → missed updates; re-fetch full row
       - seq <= local_seq       → duplicate/old; ignore
    2. Apply full snapshot to local store
    3. Compute timer from timer_started_at + timer_duration_ms
    4. Adjust for timer_paused_at if set
    5. If game_data.warning_at newly set → trigger alarm UI
    6. If game_data.final_warning_at newly set → trigger buzzer
    7. If phase = 'game_over' → show GameOverScreen
    8. If phase = 'waiting' or 'abandoned' → navigate to lobby or home

Postgres Changes → game_events WHERE room_id = $roomId
  on INSERT (is_public = true) → add to event list for all clients
  on INSERT (is_public = false, player_id = me OR target = me) → add private event
  on UPDATE (is_evaluated = true) → show result feedback
  HOST ONLY: on INSERT → evaluate event; write is_evaluated + game_state update

Postgres Changes → game_players WHERE room_id = $roomId
  on UPDATE → update player list (team, connection, elimination, role)

Supabase Presence → channel: room:{roomId}
  on sync/join/leave → update connection indicators
```

### Mount / reconnect behavior

On every play page mount (initial load, reconnect, rejoin):

```
1. Call get_game_state_for_player(roomId, myPlayerId)
   → returns game_state with private_data filtered to what I can see
   → hydrate local store from this single read

2. Read game_events WHERE room_id = $roomId
                    AND round_number = game_state.current_round
                    AND (is_public = true OR player_id = me OR target_player_id = me)
   → restore event history for current round

3. Subscribe to all Postgres Changes above

4. If timer_started_at is set and timer_started_at + timer_duration_ms > now():
   → start local countdown (timer is still running)
   → apply warning/buzzer states from game_data.warning_at / final_warning_at

5. If phase = 'game_over' → show GameOverScreen immediately
```

---

## `active_players` Field Guide

The `active_players` JSONB array replaces `current_actor_id` and `current_team_id`. It models every possible actor pattern:

### Single actor (Pictionary)

```jsonc
[{ "player_id": "uuid_B", "team_id": "Team A", "role_in_phase": "drawer", "has_acted": false }]
```

### All players act simultaneously (party trivia)

```jsonc
[
  { "player_id": "uuid_A", "team_id": "Team A", "role_in_phase": "guesser", "has_acted": false },
  { "player_id": "uuid_B", "team_id": "Team A", "role_in_phase": "guesser", "has_acted": false },
  { "player_id": "uuid_C", "team_id": "Team B", "role_in_phase": "guesser", "has_acted": false }
]
```

### Parallel team actors (two spymasters giving clues at once)

```jsonc
[
  { "player_id": "uuid_red_spy", "team_id": "red", "role_in_phase": "spymaster", "has_acted": false },
  { "player_id": "uuid_blue_spy", "team_id": "blue", "role_in_phase": "spymaster", "has_acted": false }
]
```

### Role-restricted action (Werewolf: only the Seer acts)

```jsonc
[{ "player_id": "uuid_seer", "team_id": "village", "role_in_phase": "seer", "has_acted": false }]
```

### Client usage

```typescript
const isActivePlayer = game_state.active_players.some(
  a => a.player_id === myPlayerId
);
const myActiveRole = game_state.active_players.find(
  a => a.player_id === myPlayerId
)?.role_in_phase ?? null;
const haveIActed = game_state.active_players.find(
  a => a.player_id === myPlayerId
)?.has_acted ?? false;
```

---

## `player_states` Field Guide

Replaces the flat `player_scores` and `team_scores` integer maps.

### Simple scoring (Pictionary, Trivia)

```jsonc
{
  "uuid_A": { "score": 150, "streak": 3 },
  "uuid_B": { "score": 100, "streak": 0 }
}
```

### Lives-based (battle royale, elimination trivia)

```jsonc
{
  "uuid_A": { "score": 0, "lives": 2, "status": "alive" },
  "uuid_B": { "score": 0, "lives": 0, "status": "eliminated" }
}
```

### Multi-resource (Catan-style)

```jsonc
{
  "uuid_A": { "victory_points": 7, "settlements": 3, "cities": 1 },
  "uuid_B": { "victory_points": 5, "settlements": 2, "cities": 0 }
}
```

### Platform utility functions (TypeScript helpers, not DB)

```typescript
// Provided by the platform layer; game logic calls these instead of
// manually constructing the JSONB update.
function incrementScore(states: PlayerStates, playerId: string, points: number): PlayerStates
function decrementLives(states: PlayerStates, playerId: string): PlayerStates
function eliminatePlayer(states: PlayerStates, playerId: string): PlayerStates
function setResourceValue(states: PlayerStates, playerId: string, key: string, value: number): PlayerStates
function addToResource(states: PlayerStates, playerId: string, key: string, delta: number): PlayerStates
```

---

## `round_result` Field Guide

Null until the round ends. Shape is game-defined.

```jsonc
// Pictionary — single winner
{ "winner_player_id": "uuid_C", "winner_team_id": "Team A", "points_awarded": 200, "word": "elephant" }

// Pictionary — timeout, no winner
null

// Trivia — multiple correct players
{ "correct_players": [{ "player_id": "uuid_A", "points": 100 }, { "player_id": "uuid_C", "points": 100 }] }

// Werewolf day — elimination vote result
{ "eliminated_player_id": "uuid_B", "elimination_type": "vote", "vote_count": 4, "was_werewolf": true }

// Codenames — clue + guesses resolved
{ "team_id": "red", "cards_revealed": 2, "hit_assassin": false, "hit_opponent": false, "points_scored": 2 }

// Cooperative game — all succeed or all fail
{ "success": true, "objectives_completed": 3, "objectives_total": 3 }
```

---

## `game_data` Field Guide Per Game

### Pictionary

```jsonc
// game_data (public — all players see this)
{
  "word_category": "Animals",
  "word_difficulty": "medium",
  "point_value": 100,
  "used_word_ids": ["uuid1", "uuid2"],
  "warning_at": "2024-01-01T12:00:50.000Z",
  "final_warning_at": "2024-01-01T12:00:55.000Z"
}

// private_data (filtered per player)
{
  "uuid_drawer": { "word": "elephant" }
  // Non-drawers get {} from get_game_state_for_player()
}
```

### Trivia

```jsonc
// game_data (public)
{
  "question_id": "uuid",
  "question_text": "What is the capital of France?",
  "category": "Geography",
  "difficulty": "easy",
  "answer_revealed": false,
  "point_value": 100,
  "buzz_order": ["uuid_A"],
  "warning_at": "...",
  "final_warning_at": "..."
}

// private_data
{
  "role:host": { "correct_answer": "Paris" }
}
```

### Codenames

```jsonc
// game_data (public)
{
  "board": [
    { "word": "APPLE", "team": "red", "revealed": false, "revealed_by": null },
    { "word": "TRAIN", "team": "blue", "revealed": true, "revealed_by": "uuid_B" }
    // ...23 more
  ],
  "clue_word": null,
  "clue_count": null,
  "guesses_remaining": 0,
  "red_remaining": 7,
  "blue_remaining": 8,
  "assassin_hit": false
}

// private_data
{
  "role:spymaster:red":  { "key_card": [ ...25 entries with team assignment ] },
  "role:spymaster:blue": { "key_card": [ ...same 25 entries ] }
}
```

### Werewolf

```jsonc
// game_data (public)
{
  "day_number": 2,
  "alive_count": 7,
  "vote_tally": { "uuid_A": 3, "uuid_B": 1 },
  "last_eliminated": { "player_id": "uuid_X", "was_werewolf": false },
  "night_actions_complete": false
}

// private_data
{
  "role:werewolf": { "teammates": ["uuid_wolf2", "uuid_wolf3"] },
  "uuid_seer":     { "seen": [{ "player_id": "uuid_A", "is_werewolf": false }] },
  "uuid_doctor":   { "protected_last_night": "uuid_B" }
}
```

---

## Full Timeline: One Round of Pictionary

```
HOST CLIENT                       DB WRITE                       ALL CLIENTS
────────────────────────────────────────────────────────────────────────────────

[L5] Host clicks "Start Game"
                                  game_rooms UPDATE: status='playing'
                                  game_state UPSERT:
                                    phase='picking_difficulty'
                                    current_round=1, total_rounds=6
                                    active_players=[{player_B, drawer}]
                                    player_states={ A:{score:0}, B:{score:0}, ... }
                                    team_states={ 'Team A':{score:0}, ... }
                                    settings_snapshot={timer_ms:60000,...}
                                    seq=1
                                                                → non-host clients:
                                                                  game_rooms change fires
                                                                  navigate to /play
                                                                  read game_state row
                                                                  render DifficultyPicker

[R2] Drawer (B) picks "Hard"      game_state UPSERT:
                                    phase='previewing'
                                    game_data={ category:'Animals', difficulty:'hard',
                                                point_value:200 }
                                    private_data={ 'uuid_B': { word:'elephant' } }
                                    phase_entered_at=T₁, seq=2
                                                                → all clients:
                                                                  phase='previewing'
                                                                  drawer sees word (from private_data)
                                                                  others see "Get ready..."
                                                                  start 10s local countdown

[R4] Preview ends (drawer writes)  game_state UPSERT:
                                    phase='drawing'
                                    timer_started_at=T₂
                                    timer_duration_ms=60000
                                    phase_entered_at=T₂, seq=3
                                                                → all clients:
                                                                  remaining = 60000-(now-T₂)
                                                                  show DrawerView/GuesserView

[R5] Host at T₂+15000ms           game_state UPSERT: seq=4     → seq check: all OK

[R6] Host at T₂+30000ms           game_state UPSERT: seq=5     → seq check: all OK

[R7] Host at T₂+45000ms           game_state UPSERT: seq=6     → seq check: all OK

[R8] Host at T₂+50000ms           game_state UPSERT:
                                    game_data.warning_at=T₂+50000, seq=7
                                                                → all clients:
                                                                  alarm fires at same moment

[R9] Host at T₂+55000ms           game_state UPSERT:
                                    game_data.final_warning_at=T₂+55000, seq=8
                                                                → all clients: buzzer fires

[E1] Player C inserts guess        game_events INSERT:
                                    event_type='guess'
                                    event_data={ text:'elephant' }
                                    player_id=uuid_C, round_number=1
                                    is_public=true
                                                                → all clients: see guess appear
                                                                → HOST: Postgres Changes fires
                                                                         evaluates: correct!

[R11] Host writes result           game_state UPSERT:
                                    phase='round_end'
                                    timer_started_at=null
                                    round_result={ winner_player_id:C,
                                                   winner_team_id:'Team A',
                                                   points_awarded:200,
                                                   word:'elephant' }
                                    player_states={ C:{score:200}, B:{score:100}, ... }
                                    team_states={ 'Team A':{score:300} }
                                    seq=9
                                  game_events UPDATE:
                                    is_evaluated=true, is_accepted=true
                                    result_data={ points_awarded:200 }
                                                                → all clients:
                                                                  timer stops (started_at=null)
                                                                  show RoundResults
                                                                  show updated scores

[R15] Host clicks "Next Round"     game_state UPSERT:
                                    phase='picking_difficulty'
                                    current_round=2
                                    active_players=[{player_D, drawer}]
                                    round_result=null
                                    private_data={}
                                    game_data={ ...cleared }
                                    seq=10
                                                                → all clients:
                                                                  show DifficultyPicker for D
```

---

## What This Schema Supports vs. What It Eliminates

### Games supported by this schema without modification

| Game | Actor model | Scoring | Private data | Notes |
|---|---|---|---|---|
| Pictionary | single | cumulative | word (drawer only) | Current game |
| Trivia (buzzer) | simultaneous → single | cumulative | correct answer (host only) | |
| Codenames | role_based (spymasters) | team cumulative | key card (spymasters) | |
| Werewolf / Mafia | role_based (by phase) | elimination | roles, night actions | |
| Scattergories | simultaneous | cumulative | none | |
| Taboo | single | cumulative | forbidden words (drawer) | |
| Alias / Password | single | cumulative | word (describer) | |
| Among Us-style | role_based | elimination | role (crewmate/impostor) | |
| 20 Questions | single | cumulative | secret word (host) | |
| Bingo | simultaneous | first-to-complete | card (each player) | |

### Problems eliminated vs. previous architecture

| Old Problem | Eliminated By |
|---|---|
| Missed `game:start` → stuck in lobby | `game_rooms.status` Postgres Changes → navigate |
| Missed any phase broadcast → stuck forever | `game_state.phase` Postgres Changes → always applied |
| Timer desync / drift | `timer_started_at` + client math; no sync broadcasts |
| Alarm fires at different times per client | `warning_at` absolute timestamp in DB |
| 60 `timer:sync` broadcasts per round | Replaced by 5–7 heartbeat DB writes |
| Rejoining player sees blank state | Mount: read `game_state` row → instant hydration |
| Double `round:end` race condition | DB write is idempotent; second identical phase write is a no-op |
| `onGuessReceived` listener churn crashing broadcasts | `game_events` Postgres Changes — no function refs |
| Single-actor limitation breaks parallel games | `active_players` array |
| Flat score integers break lives/resource games | `player_states` flexible JSONB |
| Round "winner" concept breaks no-winner games | `round_result` JSONB — null is valid |
| No private information model | `private_data` + `get_game_state_for_player()` |
| Hardcoded game logic in platform code | `game_registry` provides structural metadata |
| Every new game needs new realtime code | All games use same 5 tables, same subscriptions |

---

## Implementation Order

1. **DB migration** — create `game_state`, `game_events`, and `game_registry` tables; add columns to `game_players`; create `get_game_state_for_player()` function; set RLS
2. **`game_registry` seed** — insert Pictionary config row
3. **Mount hydration** — on play page mount, call `get_game_state_for_player()` and hydrate store
4. **Postgres Changes subscriptions** — subscribe to `game_state`, `game_events`, `game_players`, `game_rooms`
5. **Host writes `game_state`** on every transition (replaces all `broadcastEvent` calls)
6. **Guesser writes `game_events`** for guesses (replaces `guess:submit` broadcast)
7. **Host evaluates `game_events`** via Postgres Changes (replaces `guess:result` broadcast)
8. **Timer rewrite** — `timer_started_at` in `game_state`; host heartbeat interval; remove all `timer:sync` broadcasts
9. **`game:start` navigation via `game_rooms.status` Postgres Changes** — remove `game:start` broadcast
10. **Remove all old broadcasts** — `timer:sync`, `guess:submit`, `guess:result`, `round:picking`, `word:preview`, `round:start`, `round:end`, `game:end`, `game:state`
11. **Platform helper library** — `incrementScore()`, `eliminatePlayer()`, `advanceActivePlayer()`, etc.
12. **(Optional)** Broadcast as fast-path optimization on top of DB writes
13. **(Optional)** Edge Function for host auto-promotion on disconnect
