"use client";

import { useSyncExternalStore, useCallback } from "react";
import {
  ReadingHistoryItem,
  BookmarkItem,
  SaveProgressInput,
  ToggleBookmarkInput,
} from "@/types/storage";

const HISTORY_KEY = "uma_reading_history_v1";
const BOOKMARKS_KEY = "uma_bookmarks_v1";
const MAX_HISTORY_ITEMS = 60;
export const MAX_BOOKMARKS_ITEMS = 200; // <--- Export giới hạn bookmark
const CUSTOM_STORAGE_EVENT = "uma_storage_updated";

const EMPTY_HISTORY: ReadingHistoryItem[] = [];
const EMPTY_BOOKMARKS: BookmarkItem[] = [];

// Subscribe to browser storage events and custom in-tab updates
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CUSTOM_STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CUSTOM_STORAGE_EVENT, callback);
  };
}

let lastHistoryRaw: string | null = null;
let cachedHistory: ReadingHistoryItem[] = EMPTY_HISTORY;

function getHistorySnapshot(): ReadingHistoryItem[] {
  if (typeof window === "undefined") return EMPTY_HISTORY;
  const raw = localStorage.getItem(HISTORY_KEY);
  if (raw !== lastHistoryRaw) {
    lastHistoryRaw = raw;
    try {
      cachedHistory = raw ? JSON.parse(raw) : EMPTY_HISTORY;
    } catch {
      cachedHistory = EMPTY_HISTORY;
    }
  }
  return cachedHistory;
}

let lastBookmarksRaw: string | null = null;
let cachedBookmarks: BookmarkItem[] = EMPTY_BOOKMARKS;

function getBookmarksSnapshot(): BookmarkItem[] {
  if (typeof window === "undefined") return EMPTY_BOOKMARKS;
  const raw = localStorage.getItem(BOOKMARKS_KEY);
  if (raw !== lastBookmarksRaw) {
    lastBookmarksRaw = raw;
    try {
      cachedBookmarks = raw ? JSON.parse(raw) : EMPTY_BOOKMARKS;
    } catch {
      cachedBookmarks = EMPTY_BOOKMARKS;
    }
  }
  return cachedBookmarks;
}

function notifyStorageChange() {
  window.dispatchEvent(new Event(CUSTOM_STORAGE_EVENT));
}

export type ToggleBookmarkResult = {
  ok: boolean;
  reason?: "limit_reached" | "error";
};

export function useReadingTracker() {
  const history = useSyncExternalStore(
    subscribe,
    getHistorySnapshot,
    () => EMPTY_HISTORY,
  );

  const bookmarks = useSyncExternalStore(
    subscribe,
    getBookmarksSnapshot,
    () => EMPTY_BOOKMARKS,
  );

  const isReady = typeof window !== "undefined";

  const recordProgress = useCallback((item: SaveProgressInput) => {
    const current = getHistorySnapshot();
    const remaining = current.filter((h) => h.tweetId !== item.tweetId);
    const nextState: ReadingHistoryItem[] = [
      { ...item, updatedAt: Date.now() },
      ...remaining,
    ].slice(0, MAX_HISTORY_ITEMS);

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextState));
      notifyStorageChange();
    } catch (e) {
      console.error("Failed to save history", e);
    }
  }, []);

  // Toggle bookmark with limit check
  const toggleBookmark = useCallback(
    (item: ToggleBookmarkInput): ToggleBookmarkResult => {
      const current = getBookmarksSnapshot();
      const exists = current.some((b) => b.tweetId === item.tweetId);

      // Nếu chưa có mà danh sách đã chạm ngưỡng MAX_BOOKMARKS_ITEMS -> Chặn & thông báo
      if (!exists && current.length >= MAX_BOOKMARKS_ITEMS) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("uma_bookmark_warning", {
              detail: {
                message: `Bookmark đã đạt giới hạn tối đa (${MAX_BOOKMARKS_ITEMS} truyện). Vui lòng bỏ lưu bớt truyện cũ để thêm mới!`,
              },
            }),
          );
        }
        return { ok: false, reason: "limit_reached" };
      }

      const nextState: BookmarkItem[] = exists
        ? current.filter((b) => b.tweetId !== item.tweetId)
        : [{ ...item, bookmarkedAt: Date.now() }, ...current];

      try {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(nextState));
        notifyStorageChange();
        return { ok: true };
      } catch (e) {
        console.error("Failed to update bookmarks", e);
        return { ok: false, reason: "error" };
      }
    },
    [],
  );

  const isBookmarked = useCallback(
    (tweetId: string) => bookmarks.some((b) => b.tweetId === tweetId),
    [bookmarks],
  );

  const getProgress = useCallback(
    (tweetId: string) => history.find((h) => h.tweetId === tweetId),
    [history],
  );

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(HISTORY_KEY);
      notifyStorageChange();
    } catch (e) {
      console.error("Failed to clear history", e);
    }
  }, []);

  return {
    isReady,
    history,
    bookmarks,
    maxBookmarks: MAX_BOOKMARKS_ITEMS,
    recordProgress,
    toggleBookmark,
    isBookmarked,
    getProgress,
    clearHistory,
  };
}
