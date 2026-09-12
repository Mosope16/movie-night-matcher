"use client";

import Image from "next/image";
import { Check, Clapperboard, Copy, Loader2, LogIn, Plus, RefreshCw, Users, X, ChevronDown } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getBrowserUserId, getSavedNickname, makeRoomCode, saveNickname } from "@/lib/session";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Match, Movie, Participant, Room, RoomFilters } from "@/lib/types";
import { SwipeableCard } from "./swipeable-card";

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

// Mobile tab type — only used on small screens
type MobileTab = "lobby" | "swipe" | "room";

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
  const [mobileTab, setMobileTab] = useState<MobileTab>("lobby");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setUserId(getBrowserUserId());
      setNickname(getSavedNickname());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Automatically switch to swipe tab when room is created/joined on mobile
  useEffect(() => {
    if (room) {
      setMobileTab("swipe");
    }
  }, [room?.id]);

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
    setMobileTab("lobby");
  }

  // ─── Shared panels ────────────────────────────────────────────────────────

  const lobbyPanel = (
    <div>
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
    </div>
  );

  const roomPanel = (
    <div>
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
    </div>
  );

  const swipeSection = (
    <section className="relative flex min-h-[calc(100dvh-120px)] flex-col overflow-hidden rounded-lg border border-ink/10 bg-night text-white shadow-deck lg:min-h-[620px]">
      {room && currentMovie ? (
        <>
          {room.movie_deck.map((movie, index) => {
            if (index < movieIndex || index > movieIndex + 1) return null;
            return (
              <SwipeableCard
                key={movie.id}
                movie={movie}
                room={room}
                index={index}
                totalMovies={room.movie_deck.length}
                isMatched={likedMatchIds.has(movie.id)}
                isActive={index === movieIndex}
                zIndex={room.movie_deck.length - index}
                onSwipe={(liked) => void swipe(liked)}
              />
            );
          })}
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Clapperboard className="mb-5 text-saffron" size={58} aria-hidden />
          <h2 className="text-4xl font-black">Start with a room.</h2>
          <p className="mt-4 text-white/70">
            Create a room, share the code, and everyone swipes through the same movie deck from their own screen.
          </p>
          {/* On mobile, prompt them to go to the Lobby tab to set up */}
          <button
            className="mt-6 flex items-center gap-2 rounded-md bg-tomato px-5 py-2.5 font-semibold text-white lg:hidden"
            onClick={() => setMobileTab("lobby")}
          >
            <Plus size={18} aria-hidden />
            Create or join a room
          </button>
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
  );

  // ─── Mobile bottom tab bar ─────────────────────────────────────────────────

  const mobileTabs: { id: MobileTab; label: string; badge?: number }[] = [
    { id: "lobby", label: "Lobby" },
    { id: "swipe", label: "Swipe", badge: room ? room.movie_deck.length - movieIndex : undefined },
    { id: "room", label: "Room", badge: matches.length || undefined }
  ];

  return (
    <main className="min-h-screen bg-stone-50 text-ink">
      {/* ── Desktop layout (lg+): three fixed columns ── */}
      <div className="mx-auto hidden max-w-7xl gap-5 px-6 py-5 lg:grid lg:min-h-screen lg:grid-cols-[360px_minmax(0,1fr)_320px]">
        <aside className="overflow-y-auto rounded-lg border border-ink/10 bg-white/80 p-4 shadow-sm backdrop-blur">
          {lobbyPanel}
        </aside>

        {swipeSection}

        <aside className="overflow-y-auto rounded-lg border border-ink/10 bg-white/80 p-4 shadow-sm backdrop-blur">
          {roomPanel}
        </aside>
      </div>

      {/* ── Mobile layout (below lg): tab-based ── */}
      <div className="flex min-h-screen flex-col lg:hidden">
        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {mobileTab === "lobby" && (
            <div className="p-4">
              <div className="rounded-lg border border-ink/10 bg-white/80 p-4 shadow-sm backdrop-blur">
                {lobbyPanel}
              </div>
            </div>
          )}
          {mobileTab === "swipe" && (
            <div className="p-4 pb-2">
              {swipeSection}
              {/* Desktop keyboard hint, hidden on mobile */}
            </div>
          )}
          {mobileTab === "room" && (
            <div className="p-4">
              <div className="rounded-lg border border-ink/10 bg-white/80 p-4 shadow-sm backdrop-blur">
                {roomPanel}
              </div>
            </div>
          )}
        </div>

        {/* Bottom tab bar */}
        <nav className="sticky bottom-0 z-50 flex border-t border-ink/10 bg-white/95 shadow-lg backdrop-blur">
          {mobileTabs.map((tab) => (
            <button
              key={tab.id}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition ${
                mobileTab === tab.id ? "text-tomato" : "text-ink/50 hover:text-ink"
              }`}
              onClick={() => setMobileTab(tab.id)}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 ? (
                <span className="absolute right-1/4 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-tomato px-1 text-[10px] text-white">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              ) : null}
              {mobileTab === tab.id ? (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-tomato" />
              ) : null}
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
