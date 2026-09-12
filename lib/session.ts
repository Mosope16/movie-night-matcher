const USER_ID_KEY = "movie-night-matcher:user-id";
const NICKNAME_KEY = "movie-night-matcher:nickname";

export function getBrowserUserId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(USER_ID_KEY);
  if (existing) {
    return existing;
  }

  const next = crypto.randomUUID();
  window.localStorage.setItem(USER_ID_KEY, next);
  return next;
}

export function getSavedNickname() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(NICKNAME_KEY) ?? "";
}

export function saveNickname(nickname: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(NICKNAME_KEY, nickname);
}

export function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}
