export interface ReadingHistoryItem {
  tweetId: string;
  title?: string;
  coverImage?: string;
  artistName?: string;
  translatorHandle: string;
  lastReadPageIndex: number; // 0-based page index
  totalPages: number;
  updatedAt: number; // Milliseconds timestamp
}

export interface BookmarkItem {
  tweetId: string;
  title?: string;
  coverImage?: string;
  artistName?: string;
  translatorHandle: string;
  bookmarkedAt: number; // Milliseconds timestamp
}

export type SaveProgressInput = Omit<ReadingHistoryItem, "updatedAt">;
export type ToggleBookmarkInput = Omit<BookmarkItem, "bookmarkedAt">;