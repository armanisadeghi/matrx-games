-- Matrx Games - Core Schema
-- All tables prefixed with game_ to coexist with other projects

-- ============================================
-- GAME CATALOG
-- ============================================
create table if not exists public.game_catalog (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  description   text,
  min_players   int not null default 1,
  max_players   int not null default 20,
  supports_teams boolean not null default false,
  supports_single_player boolean not null default false,
  is_active     boolean not null default true,
  icon_url      text,
  created_at    timestamptz not null default now()
);

-- ============================================
-- ROOMS (game sessions)
-- ============================================
create table if not exists public.game_rooms (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.game_catalog(id),
  host_id       uuid references auth.users(id),
  room_code     text unique not null,
  status        text not null default 'waiting'
                check (status in ('waiting', 'playing', 'paused', 'finished', 'abandoned')),
  settings      jsonb not null default '{}',
  max_players   int not null default 10,
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  expires_at    timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idx_game_rooms_code on public.game_rooms(room_code);
create index if not exists idx_game_rooms_active on public.game_rooms(status)
  where status in ('waiting', 'playing');

-- ============================================
-- PLAYERS (room participants)
-- ============================================
create table if not exists public.game_players (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.game_rooms(id) on delete cascade,
  user_id       uuid references auth.users(id),
  display_name  text not null,
  avatar_url    text,
  team_id       text,
  role          text not null default 'player'
                check (role in ('host', 'player', 'spectator')),
  game_role     text,
  is_connected  boolean not null default true,
  joined_at     timestamptz not null default now(),
  left_at       timestamptz,
  guest_token   text
);

create index if not exists idx_game_players_room on public.game_players(room_id)
  where left_at is null;

-- ============================================
-- GAME STATE (persistent game progress)
-- ============================================
create table if not exists public.game_state (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid unique not null references public.game_rooms(id) on delete cascade,
  current_round int not null default 0,
  total_rounds  int not null default 5,
  state_data    jsonb not null default '{}',
  updated_at    timestamptz not null default now()
);

-- ============================================
-- SCORES
-- ============================================
create table if not exists public.game_scores (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.game_rooms(id) on delete cascade,
  player_id     uuid not null references public.game_players(id) on delete cascade,
  round_number  int,
  points        int not null default 0,
  metadata      jsonb default '{}',
  scored_at     timestamptz not null default now()
);

create index if not exists idx_game_scores_room on public.game_scores(room_id);

-- ============================================
-- LEADERBOARD (aggregated, persistent)
-- ============================================
create table if not exists public.game_leaderboard (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id),
  game_id       uuid not null references public.game_catalog(id),
  total_score   bigint not null default 0,
  games_played  int not null default 0,
  games_won     int not null default 0,
  best_score    int not null default 0,
  last_played   timestamptz not null default now(),
  unique(user_id, game_id)
);

create index if not exists idx_leaderboard_game_score
  on public.game_leaderboard(game_id, total_score desc);

-- ============================================
-- GAME HISTORY
-- ============================================
create table if not exists public.game_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id),
  game_id       uuid not null references public.game_catalog(id),
  room_id       uuid references public.game_rooms(id),
  final_score   int not null default 0,
  placement     int,
  played_at     timestamptz not null default now()
);

create index if not exists idx_game_history_user
  on public.game_history(user_id, played_at desc);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on all tables
alter table public.game_catalog enable row level security;
alter table public.game_rooms enable row level security;
alter table public.game_players enable row level security;
alter table public.game_state enable row level security;
alter table public.game_scores enable row level security;
alter table public.game_leaderboard enable row level security;
alter table public.game_history enable row level security;

-- Game catalog: anyone can read
create policy "game_catalog_select" on public.game_catalog
  for select using (true);

-- Rooms: anyone can read, authenticated users can create
create policy "game_rooms_select" on public.game_rooms
  for select using (true);

create policy "game_rooms_insert" on public.game_rooms
  for insert with check (true);

create policy "game_rooms_update" on public.game_rooms
  for update using (true);

-- Players: anyone can read and join
create policy "game_players_select" on public.game_players
  for select using (true);

create policy "game_players_insert" on public.game_players
  for insert with check (true);

create policy "game_players_update" on public.game_players
  for update using (true);

-- Game state: participants can read, host can update
create policy "game_state_select" on public.game_state
  for select using (true);

create policy "game_state_insert" on public.game_state
  for insert with check (true);

create policy "game_state_update" on public.game_state
  for update using (true);

-- Scores: room participants can read
create policy "game_scores_select" on public.game_scores
  for select using (true);

create policy "game_scores_insert" on public.game_scores
  for insert with check (true);

-- Leaderboard: anyone can read
create policy "game_leaderboard_select" on public.game_leaderboard
  for select using (true);

create policy "game_leaderboard_upsert" on public.game_leaderboard
  for insert with check (true);

create policy "game_leaderboard_update" on public.game_leaderboard
  for update using (true);

-- Game history: users can read their own
create policy "game_history_select" on public.game_history
  for select using (auth.uid() = user_id);

create policy "game_history_insert" on public.game_history
  for insert with check (true);

-- ============================================
-- SEED DATA: Game Catalog
-- ============================================
insert into public.game_catalog (slug, name, description, min_players, max_players, supports_teams, supports_single_player)
values
  ('pictionary', 'Pictionary Helper', 'Take turns describing words to your team. The team that guesses the most words wins!', 4, 20, true, false)
on conflict (slug) do nothing;

-- ============================================
-- Enable Realtime for key tables
-- ============================================
alter publication supabase_realtime add table public.game_rooms;
alter publication supabase_realtime add table public.game_players;
alter publication supabase_realtime add table public.game_state;
