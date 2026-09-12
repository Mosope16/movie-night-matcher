# Movie Night Matcher

A realtime multiplayer movie picker. Friends join a room with a short code, swipe through the same TMDB-powered movie deck, and everyone gets a live match event when all room members like the same movie.

## Decisions

- Movie source: TMDB Discover API.
- Realtime: Supabase Realtime with Postgres change subscriptions.
- Authentication: temporary browser identity plus nickname. No account is required for the prototype.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   TMDB_API_TOKEN=...
   ```

3. Run `supabase/schema.sql` in the Supabase SQL editor.

4. Start the app:

   ```bash
   npm run dev
   ```

## Data Model

- `rooms`: room code, host browser id, filters, room status, and stored movie deck.
- `room_participants`: nicknames for each temporary browser identity in a room.
- `movie_swipes`: one left/right decision per participant per movie.
- `room_matches`: one realtime broadcast row per unanimous liked movie.

## Notes

The current RLS policies are intentionally permissive for a no-account prototype. Before shipping publicly, replace the temporary browser identity with Supabase Auth and scope policies by authenticated user and room membership.
