"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate, PanInfo } from "framer-motion";
import Image from "next/image";
import { Check, Clapperboard, X } from "lucide-react";
import type { Movie, Room } from "@/lib/types";

function posterUrl(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
}

interface SwipeableCardProps {
  movie: Movie;
  room: Room;
  index: number;
  totalMovies: number;
  isMatched: boolean;
  isActive: boolean; // Only the top card is active/draggable
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

  // Map the horizontal drag (x) to rotation
  const rotate = useTransform(x, [-300, 300], [-15, 15]);

  // Color overlays for visual feedback during swipe
  const nopeOpacity = useTransform(x, [-100, -20], [0.8, 0]);
  const likeOpacity = useTransform(x, [20, 100], [0, 0.8]);

  const handleDragEnd = async (event: any, info: PanInfo) => {
    const threshold = 120;
    
    if (info.offset.x > threshold) {
      // Swiped right (Like)
      await animate(x, 800, { duration: 0.3 });
      onSwipe(true);
    } else if (info.offset.x < -threshold) {
      // Swiped left (Nope)
      await animate(x, -800, { duration: 0.3 });
      onSwipe(false);
    } else {
      // Didn't drag far enough, spring back
      animate(x, 0, { type: "spring", stiffness: 300, damping: 20 });
    }
  };

  const handleButtonSwipe = async (liked: boolean) => {
    if (!isActive) return;
    const targetX = liked ? 800 : -800;
    await animate(x, targetX, { duration: 0.3 });
    onSwipe(liked);
  };

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        void handleButtonSwipe(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        void handleButtonSwipe(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, x, onSwipe]);

  return (
    <motion.div
      className="absolute inset-0 bg-night grid h-full w-full lg:grid-cols-[minmax(280px,44%)_1fr]"
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
      <div className="relative min-h-[420px] bg-ink h-full">
        {posterUrl(movie.posterPath) ? (
          <Image
            src={posterUrl(movie.posterPath)!}
            alt={`${movie.title} poster`}
            fill
            className="object-cover pointer-events-none"
            sizes="(min-width: 1024px) 44vw, 100vw"
            priority={isActive}
          />
        ) : (
          <div className="grid h-full place-items-center bg-saffron text-ink pointer-events-none">
            <Clapperboard size={72} aria-hidden />
          </div>
        )}
        
        {/* Swipe Overlays */}
        <motion.div 
          className="absolute inset-0 bg-tomato pointer-events-none flex items-center justify-center mix-blend-overlay"
          style={{ opacity: nopeOpacity }}
        >
          <X size={120} className="text-white opacity-80" />
        </motion.div>
        
        <motion.div 
          className="absolute inset-0 bg-saffron pointer-events-none flex items-center justify-center mix-blend-overlay"
          style={{ opacity: likeOpacity }}
        >
          <Check size={120} className="text-white opacity-80" />
        </motion.div>
      </div>

      <div className="flex flex-col justify-between p-5 sm:p-8 cursor-default pointer-events-none">
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-white/70">
            <span>Room {room.code}</span>
            <span>{index + 1} of {totalMovies}</span>
            {isMatched ? <span className="text-saffron">Matched</span> : null}
          </div>
          <h2 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl">{movie.title}</h2>
          <p className="mt-3 text-sm text-white/65">
            {movie.releaseDate?.slice(0, 4) ?? "Release year unknown"} · {movie.voteAverage.toFixed(1)} TMDB
          </p>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/82">
            {movie.overview || "No synopsis available."}
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-5 sm:justify-start pointer-events-auto">
          <button
            className="grid h-16 w-16 place-items-center rounded-full bg-white text-tomato shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => void handleButtonSwipe(false)}
            aria-label="Skip this movie"
            disabled={!isActive}
          >
            <X size={30} aria-hidden />
          </button>
          <button
            className="grid h-20 w-20 place-items-center rounded-full bg-saffron text-night shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => void handleButtonSwipe(true)}
            aria-label="Like this movie"
            disabled={!isActive}
          >
            <Check size={34} aria-hidden />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
