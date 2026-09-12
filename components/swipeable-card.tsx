"use client";

import { motion, useMotionValue, useTransform, animate, PanInfo } from "framer-motion";
import { useEffect } from "react";
import Image from "next/image";
import { Check, Clapperboard, X } from "lucide-react";
import type { Movie, Room } from "@/lib/types";

function posterUrl(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/w780${path}` : null;
}

interface SwipeableCardProps {
  movie: Movie;
  room: Room;
  index: number;
  totalMovies: number;
  isMatched: boolean;
  isActive: boolean;
  zIndex: number;
  onSwipe: (liked: boolean) => void;
}

export function SwipeableCard({
  movie,
  room,
  index,
  totalMovies,
  isMatched,
  isActive,
  zIndex,
  onSwipe,
}: SwipeableCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-12, 12]);
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);

  const handleDragEnd = async (_: unknown, info: PanInfo) => {
    const threshold = 120;
    if (info.offset.x > threshold) {
      await animate(x, 900, { duration: 0.3 });
      onSwipe(true);
    } else if (info.offset.x < -threshold) {
      await animate(x, -900, { duration: 0.3 });
      onSwipe(false);
    } else {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 20 });
    }
  };

  const handleButtonSwipe = async (liked: boolean) => {
    if (!isActive) return;
    await animate(x, liked ? 900 : -900, { duration: 0.3 });
    onSwipe(liked);
  };

  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); void handleButtonSwipe(false); }
      else if (e.key === "ArrowRight") { e.preventDefault(); void handleButtonSwipe(true); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, x, onSwipe]);

  const poster = posterUrl(movie.posterPath);

  return (
    <motion.div
      className="absolute inset-0 select-none overflow-hidden rounded-lg"
      style={{ x, rotate, zIndex }}
      drag={isActive ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      whileTap={isActive ? { cursor: "grabbing" } : {}}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={isActive ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {/* Full-bleed poster */}
      {poster ? (
        <Image
          src={poster}
          alt={`${movie.title} poster`}
          fill
          className="object-cover object-center pointer-events-none"
          sizes="(min-width: 1024px) 60vw, 100vw"
          priority={isActive}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-ink">
          <Clapperboard size={80} className="text-white/30" aria-hidden />
        </div>
      )}

      {/* Dark gradient overlay — bottom two-thirds */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

      {/* Top metadata bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4 pb-2 text-xs text-white/70 pointer-events-none">
        <span className="rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">Room {room.code}</span>
        <span className="rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
          {index + 1} / {totalMovies}
          {isMatched ? " · ✓ Matched" : ""}
        </span>
      </div>

      {/* NOPE label */}
      <motion.div
        className="absolute left-6 top-16 rotate-[-20deg] rounded-lg border-4 border-tomato px-3 py-1 text-2xl font-black tracking-widest text-tomato pointer-events-none"
        style={{ opacity: nopeOpacity }}
      >
        NOPE
      </motion.div>

      {/* LIKE label */}
      <motion.div
        className="absolute right-6 top-16 rotate-[20deg] rounded-lg border-4 border-saffron px-3 py-1 text-2xl font-black tracking-widest text-saffron pointer-events-none"
        style={{ opacity: likeOpacity }}
      >
        LIKE
      </motion.div>

      {/* Movie info — pinned to bottom */}
      <div className="absolute bottom-0 inset-x-0 px-5 pb-6 pt-16 pointer-events-none">
        <h2 className="text-3xl font-black text-white leading-tight drop-shadow-lg sm:text-4xl lg:text-5xl">
          {movie.title}
        </h2>
        <p className="mt-1.5 text-sm text-white/60">
          {movie.releaseDate?.slice(0, 4) ?? "Unknown year"} · ⭐ {movie.voteAverage.toFixed(1)} TMDB
        </p>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/80 sm:line-clamp-4 lg:text-base">
          {movie.overview || "No synopsis available."}
        </p>

        {/* Action buttons */}
        <div className="mt-5 flex items-center gap-4 pointer-events-auto">
          <button
            className="grid h-14 w-14 place-items-center rounded-full bg-white/10 border-2 border-tomato text-tomato backdrop-blur-sm shadow-lg transition hover:bg-tomato hover:text-white hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => void handleButtonSwipe(false)}
            aria-label="Skip this movie"
            disabled={!isActive}
          >
            <X size={26} aria-hidden />
          </button>

          <button
            className="grid h-16 w-16 place-items-center rounded-full bg-white/10 border-2 border-saffron text-saffron backdrop-blur-sm shadow-lg transition hover:bg-saffron hover:text-night hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => void handleButtonSwipe(true)}
            aria-label="Like this movie"
            disabled={!isActive}
          >
            <Check size={30} aria-hidden />
          </button>

          <span className="ml-auto hidden text-xs text-white/40 lg:block">
            ← → keyboard shortcuts
          </span>
        </div>
      </div>
    </motion.div>
  );
}
