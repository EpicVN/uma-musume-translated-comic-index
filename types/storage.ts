export interface ReadingHistoryItem {
  tweetId: string;
  origId?: string; // 🌟 Thêm origId để lưu ID bài gốc của Comic
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
  origId?: string; // 🌟 Thêm origId để lưu ID bài gốc của Comic
  title?: string;
  coverImage?: string;
  artistName?: string;
  translatorHandle: string;
  bookmarkedAt: number; // Milliseconds timestamp
}

export type SaveProgressInput = Omit<ReadingHistoryItem, "updatedAt">;
export type ToggleBookmarkInput = Omit<BookmarkItem, "bookmarkedAt">;
