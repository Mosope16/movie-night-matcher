import { NextResponse } from "next/server";
import type { Movie } from "@/lib/types";

type TmdbMovie = {
  id: number;
  title?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  vote_average?: number;
};

export async function GET(request: Request) {
  const token = process.env.TMDB_API_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "TMDB_API_TOKEN is missing." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre");
  const year = searchParams.get("year");

  const tmdbParams = new URLSearchParams({
    include_adult: "false",
    include_video: "false",
    language: "en-US",
    page: "1",
    sort_by: "popularity.desc",
    "vote_count.gte": "100"
  });

  if (genre) {
    tmdbParams.set("with_genres", genre);
  }

  if (year) {
    tmdbParams.set("primary_release_year", year);
  }

  tmdbParams.set("api_key", token);

  const response = await fetch(`https://api.themoviedb.org/3/discover/movie?${tmdbParams.toString()}`, {
    headers: {
      accept: "application/json"
    },
    next: {
      revalidate: 60 * 30
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Could not read error body");
    console.error("TMDB API Error:", response.status, response.statusText, errorText);
    return NextResponse.json(
      { error: `Could not load movies from TMDB. Status: ${response.status}. Details: ${errorText}` },
      { status: response.status }
    );
  }

  const payload = (await response.json()) as { results?: TmdbMovie[] };
  const movies: Movie[] = (payload.results ?? []).slice(0, 20).map((movie) => ({
    id: movie.id,
    title: movie.title ?? "Untitled",
    overview: movie.overview ?? "",
    posterPath: movie.poster_path ?? null,
    releaseDate: movie.release_date ?? null,
    voteAverage: movie.vote_average ?? 0
  }));

  return NextResponse.json({ movies });
}
