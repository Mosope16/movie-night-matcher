create extension if not exists "pgcrypto";

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'waiting' check (status in ('waiting', 'swiping', 'matched', 'closed')),
  host_id text not null,
  filters jsonb not null default '{}'::jsonb,
  movie_deck jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id text not null,
  nickname text not null,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.movie_swipes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id text not null,
  movie_id integer not null,
  liked boolean not null,
  created_at timestamptz not null default now(),
  unique (room_id, user_id, movie_id)
);

create table if not exists public.room_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  movie_id integer not null,
  movie_title text not null,
  poster_path text,
  created_at timestamptz not null default now(),
  unique (room_id, movie_id)
);

alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.movie_swipes enable row level security;
alter table public.room_matches enable row level security;

create policy "rooms are readable by guests"
  on public.rooms for select
  using (true);

create policy "guests can create rooms"
  on public.rooms for insert
  with check (true);

create policy "guests can update rooms"
  on public.rooms for update
  using (true)
  with check (true);

create policy "participants are readable by guests"
  on public.room_participants for select
  using (true);

create policy "guests can join rooms"
  on public.room_participants for insert
  with check (true);

create policy "guests can update their room participant"
  on public.room_participants for update
  using (true)
  with check (true);

create policy "swipes are readable by guests"
  on public.movie_swipes for select
  using (true);

create policy "guests can record swipes"
  on public.movie_swipes for insert
  with check (true);

create policy "guests can update swipes"
  on public.movie_swipes for update
  using (true)
  with check (true);

create policy "matches are readable by guests"
  on public.room_matches for select
  using (true);

create policy "guests can record matches"
  on public.room_matches for insert
  with check (true);

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_participants;
alter publication supabase_realtime add table public.movie_swipes;
alter publication supabase_realtime add table public.room_matches;
