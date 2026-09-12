export type Movie = {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number;
};

export type Room = {
  id: string;
  code: string;
  status: "waiting" | "swiping" | "matched" | "closed";
  host_id: string;
  filters: RoomFilters;
  movie_deck: Movie[];
  created_at: string;
};

export type RoomFilters = {
  genre?: string;
  year?: string;
};

export type Participant = {
  id: string;
  room_id: string;
  user_id: string;
  nickname: string;
  created_at: string;
};

export type Match = {
  id: string;
  room_id: string;
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
  created_at: string;
};
