"use client";

import { useState, useSyncExternalStore, useEffect } from "react";
import Link from "next/link";
import {
  useReadingTracker,
  MAX_BOOKMARKS_ITEMS,
} from "@/hooks/useReadingTracker";
import TweetGridCard from "@/components/TweetGridCard";
import { BookmarkItem, ReadingHistoryItem } from "@/types/storage";

const emptySubscribe = () => () => {};

export default function LibraryPage() {
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    document.title = "Your Library | A Certain Umazing Index";
  }, []);

  const [activeTab, setActiveTab] = useState<"bookmarks" | "history">(
    "bookmarks",
  );
  const { bookmarks, history, clearHistory } = useReadingTracker();
  const maxBookmarks = MAX_BOOKMARKS_ITEMS;

  const isBookmarkFull = bookmarks.length >= maxBookmarks;
  const isBookmarkNearFull =
    bookmarks.length >= maxBookmarks * 0.9 && !isBookmarkFull;

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#0b1622] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#3db4f2] border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(61,180,242,0.5)]" />
          <span className="text-xs font-black tracking-widest text-[#3db4f2] uppercase">
            Loading Library...
          </span>
        </div>
      </div>
    );
  }

  const renderItemAsCard = (item: BookmarkItem | ReadingHistoryItem) => {
    const getDateVal = (): Date => {
      if ("updatedAt" in item && typeof item.updatedAt === "number") {
        return new Date(item.updatedAt);
      }
      if ("bookmarkedAt" in item && typeof item.bookmarkedAt === "number") {
        return new Date(item.bookmarkedAt);
      }
      return new Date();
    };

    return (
      <TweetGridCard
        key={item.tweetId}
        transId={item.tweetId}
        origId=""
        artistName={item.artistName || "Unknown"}
        translatorName={item.translatorHandle || "Unknown"}
        transMediaUrls={item.coverImage ? [item.coverImage] : []}
        origMediaUrls={[]}
        tags={[]}
        postedAt={getDateVal()}
        priority={false}
        onOpenReader={() =>
          window.open(`https://x.com/i/status/${item.tweetId}`, "_blank")
        }
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#0b1622] bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-[#162945] via-[#0b1622] to-[#0b1622] text-[#bcbedc]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 relative z-10">
        {/* Top Navigation & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1e2d42]/60 mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="group flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-[#3db4f2]/20 hover:border-[#3db4f2]/50 transition-all duration-300 shadow-sm active:scale-95"
              title="Back to Main Feed"
            >
              <svg
                className="w-5 h-5 text-[#8ba0b2] group-hover:text-[#3db4f2] group-hover:-translate-x-0.5 transition-all"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>

            <div className="flex flex-col">
              <h1
                className="text-xl sm:text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-linear-to-r from-white to-[#cbd5e1] drop-shadow-sm uppercase pr-3"
                style={{ fontFamily: "'CCWildWords Roman', sans-serif" }}
              >
                YOUR LIBRARY
              </h1>
              <span className="text-[10px] font-bold text-[#3db4f2] tracking-widest uppercase">
                Personal Archive
              </span>
            </div>
          </div>

          {/* Pill-shaped Tab Switcher */}
          <div className="inline-flex items-center p-1.5 rounded-full bg-[#0a111a] border border-[#1e2d42] shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("bookmarks")}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-black tracking-widest uppercase transition-all duration-300 ${
                activeTab === "bookmarks"
                  ? "bg-linear-to-r from-[#f43f5e] to-[#be123c] text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                  : "text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/5"
              }`}
            >
              Bookmarks{" "}
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] ${
                  isBookmarkFull
                    ? "bg-amber-500 text-black font-black"
                    : isBookmarkNearFull
                      ? "bg-yellow-500/20 text-yellow-300 font-bold"
                      : "bg-white/20"
                }`}
              >
                {bookmarks.length}/{maxBookmarks}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-black tracking-widest uppercase transition-all duration-300 ${
                activeTab === "history"
                  ? "bg-linear-to-r from-[#3db4f2] to-[#2563eb] text-white shadow-[0_0_15px_rgba(61,180,242,0.4)]"
                  : "text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/5"
              }`}
            >
              History{" "}
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">
                {history.length}
              </span>
            </button>
          </div>
        </div>

        {/* Warning Banners */}
        {activeTab === "bookmarks" && isBookmarkFull && (
          <div className="mb-6 px-4 py-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center justify-between shadow-lg">
            <span className="flex items-center gap-2">
              ⚠️ Bookmark storage has reached maximum capacity ({maxBookmarks}/
              {maxBookmarks}). Please remove older bookmarks to save new ones.
            </span>
          </div>
        )}
        {activeTab === "bookmarks" && isBookmarkNearFull && !isBookmarkFull && (
          <div className="mb-6 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-xs font-semibold flex items-center justify-between">
            <span>
              ⚡ Bookmark storage is almost full ({bookmarks.length}/
              {maxBookmarks}).
            </span>
          </div>
        )}

        {/* Bookmarks Tab Content */}
        {activeTab === "bookmarks" && (
          <>
            {bookmarks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 bg-[#0f1724]/60 backdrop-blur-md rounded-3xl border border-[#1e2d42] px-4 shadow-xl">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-[#0b1622] border-2 border-[#f43f5e]/30 flex items-center justify-center text-[#f43f5e] shadow-[0_0_30px_rgba(244,63,94,0.15)]">
                  <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white tracking-wide uppercase">
                  No Bookmarks
                </h3>
                <p className="text-xs text-[#8ba0b2] mt-2 max-w-sm text-center">
                  Save your favorite comics from the main feed to access them
                  here anytime.
                </p>
                <Link
                  href="/"
                  className="mt-6 px-6 py-2.5 text-[11px] font-black tracking-widest uppercase bg-white/10 hover:bg-[#3db4f2]/20 text-white rounded-full transition-all duration-300 border border-white/20 hover:border-[#3db4f2]/60 hover:shadow-[0_0_20px_rgba(61,180,242,0.3)] active:scale-95"
                >
                  Explore Feed
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6 items-start">
                {bookmarks.map(renderItemAsCard)}
              </div>
            )}
          </>
        )}

        {/* Reading History Tab Content */}
        {activeTab === "history" && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <span className="text-[11px] font-black tracking-widest uppercase text-[#64748b] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3db4f2] animate-pulse"></span>
                Recently Opened Comics ({history.length} records)
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-[10px] font-black tracking-widest uppercase text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 px-4 py-1.5 rounded-full transition-colors border border-rose-500/30"
                >
                  Clear History
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 bg-[#0f1724]/60 backdrop-blur-md rounded-3xl border border-[#1e2d42] px-4 shadow-xl">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-[#0b1622] border-2 border-[#3db4f2]/30 flex items-center justify-center text-[#3db4f2] shadow-[0_0_30px_rgba(61,180,242,0.15)]">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white tracking-wide uppercase">
                  No History
                </h3>
                <p className="text-xs text-[#8ba0b2] mt-2 text-center">
                  Comics you open will automatically be tracked here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6 items-start">
                {history.map(renderItemAsCard)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
