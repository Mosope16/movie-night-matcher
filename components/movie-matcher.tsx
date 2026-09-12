"use client";

import Image from "next/image";
import { Check, Clapperboard, Copy, Loader2, LogIn, Plus, RefreshCw, Users, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getBrowserUserId, getSavedNickname, makeRoomCode, saveNickname } from "@/lib/session";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Match, Movie, Participant, Room, RoomFilters } from "@/lib/types";

const genres = [
  { id: "", name: "Any genre" },
  { id: "28", name: "Action" },
  { id: "35", name: "Comedy" },
  { id: "18", name: "Drama" },
  { id: "27", name: "Horror" },
  { id: "10749", name: "Romance" },
  { id: "878", name: "Sci-Fi" },
  { id: "53", name: "Thriller" }
];

function posterUrl(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
}

export default function MovieMatcher() {
  const [userId, setUserId] = useState("");
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [filters, setFilters] = useState<RoomFilters>({ genre: "", year: "" });
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [movieIndex, setMovieIndex] = useState(0);
  const [lastMatch, setLastMatch] = useState<Match | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setUserId(getBrowserUserId());
      setNickname(getSavedNickname());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!room || !supabase) {
      return;
    }

    const client = supabase;

    const loadRoomData = async () => {
      const [{ data: roomParticipants }, { data: roomMatches }] = await Promise.all([
        client.from("room_participants").select("*").eq("room_id", room.id).order("created_at"),
        client.from("room_matches").select("*").eq("room_id", room.id).order("created_at", { ascending: false })
      ]);

      setParticipants(roomParticipants ?? []);
      setMatches(roomMatches ?? []);
    };

    void loadRoomData();

    const channel = client
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${room.id}` },
        () => void loadRoomData()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_matches", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const nextMatch = payload.new as Match;
          setMatches((current) => [nextMatch, ...current.filter((match) => match.id !== nextMatch.id)]);
          setLastMatch(nextMatch);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as Room)
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [room]);

  const currentMovie = room?.movie_deck[movieIndex] ?? null;
  const likedMatchIds = useMemo(() => new Set(matches.map((match) => match.movie_id)), [matches]);

  async function loadMovies(roomFilters: RoomFilters) {
    const params = new URLSearchParams();
    if (roomFilters.genre) {
      params.set("genre", roomFilters.genre);
    }
    if (roomFilters.year) {
      params.set("year", roomFilters.year);
    }

    const response = await fetch(`/api/movies?${params.toString()}`);
    const payload = (await response.json()) as { movies?: Movie[]; error?: string };

    if (!response.ok || !payload.movies?.length) {
      throw new Error(payload.error ?? "No movies were found for those filters.");
    }

    return payload.movies;
  }

  function requireReadyNickname() {
    const trimmed = nickname.trim();
    if (!trimmed) {
      throw new Error("Enter a nickname first.");
    }
    saveNickname(trimmed);
    return trimmed;
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !isSupabaseConfigured) {
      setError("Add your Supabase keys in .env.local before creating a room.");
      return;
    }

    setIsBusy(true);
    setError("");

    try {
      const cleanNickname = requireReadyNickname();
      const activeUserId = userId || getBrowserUserId();
      const deck = await loadMovies(filters);
      const code = makeRoomCode();

      const { data: createdRoom, error: roomError } = await supabase
        .from("rooms")
        .insert({
          code,
          host_id: activeUserId,
          filters,
          movie_deck: deck,
          status: "swiping"
        })
        .select()
        .single();

      if (roomError) {
        throw roomError;
      }

      const { error: participantError } = await supabase.from("room_participants").upsert(
        {
          room_id: createdRoom.id,
          user_id: activeUserId,
          nickname: cleanNickname
        },
        { onConflict: "room_id,user_id" }
      );

      if (participantError) {
        throw participantError;
      }

      setRoom(createdRoom as Room);
      setMovieIndex(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the room.");
    } finally {
      setIsBusy(false);
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !isSupabaseConfigured) {
      setError("Add your Supabase keys in .env.local before joining a room.");
      return;
    }

    setIsBusy(true);
    setError("");

    try {
      const cleanNickname = requireReadyNickname();
      const activeUserId = userId || getBrowserUserId();
      const { data: existingRoom, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", joinCode.trim().toUpperCase())
        .single();

      if (roomError || !existingRoom) {
        throw new Error("That room code was not found.");
      }

      const { error: participantError } = await supabase.from("room_participants").upsert(
        {
          room_id: existingRoom.id,
          user_id: activeUserId,
          nickname: cleanNickname
        },
        { onConflict: "room_id,user_id" }
      );

      if (participantError) {
        throw participantError;
      }

      setRoom(existingRoom as Room);
      setMovieIndex(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join the room.");
    } finally {
      setIsBusy(false);
    }
  }

  async function checkForMatch(movie: Movie) {
    if (!supabase || !room) {
      return;
    }

    const [{ data: roomParticipants }, { data: likedSwipes }] = await Promise.all([
      supabase.from("room_participants").select("user_id").eq("room_id", room.id),
      supabase.from("movie_swipes").select("user_id").eq("room_id", room.id).eq("movie_id", movie.id).eq("liked", true)
    ]);

    const requiredIds = new Set((roomParticipants ?? []).map((participant) => participant.user_id));
    const likedIds = new Set((likedSwipes ?? []).map((swipe) => swipe.user_id));
    const everyParticipantLiked = requiredIds.size > 0 && [...requiredIds].every((participantId) => likedIds.has(participantId));

    if (!everyParticipantLiked) {
      return;
    }

    await supabase.from("room_matches").upsert(
      {
        room_id: room.id,
        movie_id: movie.id,
        movie_title: movie.title,
        poster_path: movie.posterPath
      },
      { onConflict: "room_id,movie_id" }
    );
  }

  async function swipe(liked: boolean) {
    if (!supabase || !room || !currentMovie) {
      return;
    }

    setError("");

    const { error: swipeError } = await supabase.from("movie_swipes").upsert(
      {
        room_id: room.id,
        user_id: userId || getBrowserUserId(),
        movie_id: currentMovie.id,
        liked
      },
      { onConflict: "room_id,user_id,movie_id" }
    );

    if (swipeError) {
      setError("Your swipe could not be saved.");
      return;
    }

    if (liked) {
      await checkForMatch(currentMovie);
    }

    setMovieIndex((index) => Math.min(index + 1, (room.movie_deck.length || 1) - 1));
  }

  function leaveRoom() {
    setRoom(null);
    setParticipants([]);
    setMatches([]);
    setMovieIndex(0);
    setLastMatch(null);
  }

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-7xl gap-5 lg:grid-cols-[360px_minmax(0,1fr)_320px]">
        <aside className="rounded-lg border border-ink/10 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-tomato text-white">
              <Clapperboard size={24} aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-bold">Movie Night Matcher</h1>
              <p className="text-sm text-ink/65">Realtime picks for indecisive groups.</p>
            </div>
          </div>

          <label className="mb-4 block text-sm font-medium">
            Nickname
            <input
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 outline-none ring-tomato/30 focus:ring-4"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Ada"
            />
          </label>

          <form className="space-y-3 border-t border-ink/10 pt-4" onSubmit={createRoom}>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">
                Genre
                <select
                  className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 outline-none ring-tomato/30 focus:ring-4"
                  value={filters.genre}
                  onChange={(event) => setFilters((current) => ({ ...current, genre: event.target.value }))}
                >
                  {genres.map((genre) => (
                    <option key={genre.id} value={genre.id}>
                      {genre.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Year
                <input
                  className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 outline-none ring-tomato/30 focus:ring-4"
                  value={filters.year}
                  onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))}
                  placeholder="2026"
                  inputMode="numeric"
                />
              </label>
            </div>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-md bg-night px-4 py-2.5 font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isBusy}
              type="submit"
            >
              {isBusy ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Plus size={18} aria-hidden />}
              Create room
            </button>
          </form>

          <form className="mt-5 space-y-3 border-t border-ink/10 pt-4" onSubmit={joinRoom}>
            <label className="text-sm font-medium">
              Room code
              <input
                className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 uppercase outline-none ring-tomato/30 focus:ring-4"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="A7K2Q"
                maxLength={5}
              />
            </label>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-md bg-mint px-4 py-2.5 font-semibold text-night transition hover:bg-mint/80 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isBusy}
              type="submit"
            >
              <LogIn size={18} aria-hidden />
              Join room
            </button>
          </form>

          {error ? <p className="mt-4 rounded-md bg-tomato/10 px-3 py-2 text-sm text-tomato">{error}</p> : null}
        </aside>

        <section className="relative grid min-h-[620px] place-items-center overflow-hidden rounded-lg border border-ink/10 bg-night text-white shadow-deck">
          {room && currentMovie ? (
            <div className="grid h-full w-full lg:grid-cols-[minmax(280px,44%)_1fr]">
              <div className="relative min-h-[420px] bg-ink">
                {posterUrl(currentMovie.posterPath) ? (
                  <Image
                    src={posterUrl(currentMovie.posterPath)!}
                    alt={`${currentMovie.title} poster`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 44vw, 100vw"
                    priority
                  />
                ) : (
                  <div className="grid h-full place-items-center bg-saffron text-ink">
                    <Clapperboard size={72} aria-hidden />
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between p-5 sm:p-8">
                <div>
                  <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-white/70">
                    <span>Room {room.code}</span>
                    <span>{movieIndex + 1} of {room.movie_deck.length}</span>
                    {likedMatchIds.has(currentMovie.id) ? <span className="text-saffron">Matched</span> : null}
                  </div>
                  <h2 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl">{currentMovie.title}</h2>
                  <p className="mt-3 text-sm text-white/65">
                    {currentMovie.releaseDate?.slice(0, 4) ?? "Release year unknown"} · {currentMovie.voteAverage.toFixed(1)} TMDB
                  </p>
                  <p className="mt-6 max-w-2xl text-base leading-7 text-white/82">{currentMovie.overview || "No synopsis available."}</p>
                </div>

                <div className="mt-8 flex items-center justify-center gap-5 sm:justify-start">
                  <button
                    className="grid h-16 w-16 place-items-center rounded-full bg-white text-tomato shadow-lg transition hover:scale-105"
                    onClick={() => void swipe(false)}
                    aria-label="Skip this movie"
                  >
                    <X size={30} aria-hidden />
                  </button>
                  <button
                    className="grid h-20 w-20 place-items-center rounded-full bg-saffron text-night shadow-lg transition hover:scale-105"
                    onClick={() => void swipe(true)}
                    aria-label="Like this movie"
                  >
                    <Check size={34} aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-lg px-6 text-center">
              <Clapperboard className="mx-auto mb-5 text-saffron" size={58} aria-hidden />
              <h2 className="text-4xl font-black">Start with a room.</h2>
              <p className="mt-4 text-white/70">
                Create a room, share the code, and everyone swipes through the same movie deck from their own screen.
              </p>
            </div>
          )}

          {lastMatch ? (
            <div className="absolute inset-0 grid place-items-center bg-night/88 p-6 backdrop-blur">
              <div className="w-full max-w-sm rounded-lg bg-white p-5 text-center text-ink shadow-deck">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-tomato">Match</p>
                {posterUrl(lastMatch.poster_path) ? (
                  <Image
                    src={posterUrl(lastMatch.poster_path)!}
                    alt={`${lastMatch.movie_title} poster`}
                    width={220}
                    height={330}
                    className="mx-auto mt-4 rounded-md object-cover"
                  />
                ) : null}
                <h3 className="mt-4 text-3xl font-black">{lastMatch.movie_title}</h3>
                <button
                  className="mt-5 rounded-md bg-night px-4 py-2 font-semibold text-white"
                  onClick={() => setLastMatch(null)}
                >
                  Keep swiping
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="rounded-lg border border-ink/10 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Room</h2>
              <p className="text-sm text-ink/60">{room ? room.code : "No active room"}</p>
            </div>
            {room ? (
              <button className="rounded-md border border-ink/15 p-2 hover:bg-ink/5" onClick={leaveRoom} aria-label="Leave room">
                <RefreshCw size={18} aria-hidden />
              </button>
            ) : null}
          </div>

          {room ? (
            <button
              className="mb-5 flex w-full items-center justify-center gap-2 rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold hover:bg-ink/5"
              onClick={() => void navigator.clipboard.writeText(room.code)}
            >
              <Copy size={16} aria-hidden />
              Copy code
            </button>
          ) : null}

          <section className="border-t border-ink/10 py-4">
            <div className="mb-3 flex items-center gap-2">
              <Users size={18} aria-hidden />
              <h3 className="font-bold">People</h3>
            </div>
            <div className="space-y-2">
              {participants.length ? (
                participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between rounded-md bg-ink/5 px-3 py-2 text-sm">
                    <span>{participant.nickname}</span>
                    {participant.user_id === room?.host_id ? <span className="font-semibold text-tomato">Host</span> : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink/60">Waiting for room members.</p>
              )}
            </div>
          </section>

          <section className="border-t border-ink/10 py-4">
            <h3 className="mb-3 font-bold">Matches</h3>
            <div className="space-y-2">
              {matches.length ? (
                matches.map((match) => (
                  <button
                    key={match.id}
                    className="flex w-full items-center gap-3 rounded-md bg-saffron/25 px-3 py-2 text-left text-sm font-semibold"
                    onClick={() => setLastMatch(match)}
                  >
                    <Check size={16} aria-hidden />
                    {match.movie_title}
                  </button>
                ))
              ) : (
                <p className="text-sm text-ink/60">No group favorite yet.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
