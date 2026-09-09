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

// Read raw items with memoized cache to avoid re-render loops
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

  // Check if code runs on client
  const isReady = typeof window !== "undefined";

  // Save or update reading progress
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

  // Toggle bookmark entry
  const toggleBookmark = useCallback((item: ToggleBookmarkInput) => {
    const current = getBookmarksSnapshot();
    const exists = current.some((b) => b.tweetId === item.tweetId);
    const nextState: BookmarkItem[] = exists
      ? current.filter((b) => b.tweetId !== item.tweetId)
      : [{ ...item, bookmarkedAt: Date.now() }, ...current];

    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(nextState));
      notifyStorageChange();
    } catch (e) {
      console.error("Failed to update bookmarks", e);
    }
  }, []);

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
    recordProgress,
    toggleBookmark,
    isBookmarked,
    getProgress,
    clearHistory,
  };
}
