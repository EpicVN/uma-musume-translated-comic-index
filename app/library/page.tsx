"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { useReadingTracker } from "@/hooks/useReadingTracker";
import BookmarkButton from "@/components/BookmarkButton";

function formatHandle(handle?: string) {
  if (!handle) return "";
  const cleaned = handle.replace(/^@+/, "");
  return `@${cleaned}`;
}

const emptySubscribe = () => () => {};

export default function LibraryPage() {
  // Check client hydration state cleanly without causing ESLint effect cascading warnings
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const [activeTab, setActiveTab] = useState<"bookmarks" | "history">(
    "bookmarks",
  );
  const { bookmarks, history, clearHistory } = useReadingTracker();

  // Render uniform loading container during server rendering & initial hydration
  if (!isHydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#3db4f2] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#8ba0b2]">
            Loading your library...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#1e2d42] mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#151f2e] border border-[#27364b] hover:border-[#3db4f2]/60 text-xs font-bold text-[#8ba0b2] hover:text-[#3db4f2] transition-all duration-150 active:scale-95"
          >
            <span>←</span> Back to Main Feed
          </Link>
          <span className="text-neutral-600">/</span>
          <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-wide">
            Your Library
          </h1>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex items-center bg-[#0b1622] p-1 rounded-xl border border-[#27364b] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("bookmarks")}
            className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "bookmarks"
                ? "bg-[#22334a] text-white shadow-sm font-bold"
                : "text-[#8ba0b2] hover:text-white"
            }`}
          >
            Bookmarks ({bookmarks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-[#22334a] text-white shadow-sm font-bold"
                : "text-[#8ba0b2] hover:text-white"
            }`}
          >
            Reading History ({history.length})
          </button>
        </div>
      </div>

      {/* Bookmarks Tab Content */}
      {activeTab === "bookmarks" && (
        <>
          {bookmarks.length === 0 ? (
            <div className="text-center py-24 bg-[#151f2e] rounded-2xl border border-[#1e2d42] px-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#0b1622] border border-[#27364b] flex items-center justify-center text-rose-500">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <p className="text-base font-semibold text-white">
                No bookmarked comics yet
              </p>
              <p className="text-xs text-[#8ba0b2] mt-1 max-w-sm mx-auto">
                Click the bookmark icon on any manga card to store it in this
                offline browser list.
              </p>
              <Link
                href="/"
                className="inline-block mt-5 px-5 py-2 text-xs font-bold bg-[#22334a] hover:bg-[#3db4f2] text-zinc-200 hover:text-white rounded-lg transition-all duration-150 border border-[#2d4260] hover:border-[#3db4f2]"
              >
                Explore Manga Feed
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 items-start">
              {bookmarks.map((item) => (
                <div
                  key={item.tweetId}
                  className="flex flex-col bg-[#151f2e] rounded-xl overflow-hidden border border-[#1e2d42] hover:border-[#3db4f2]/70 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-[#3db4f2]/10 p-3 group"
                >
                  <div className="relative w-full aspect-[3/4] mb-3 overflow-hidden rounded-lg bg-[#0b1622] border border-[#1e2d42]/40 shrink-0">
                    {item.coverImage ? (
                      <Image
                        src={item.coverImage}
                        alt={item.title || "Comic cover"}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-[#5a6f82]">
                        No preview
                      </div>
                    )}

                    <div className="absolute bottom-2 right-2 z-10">
                      <BookmarkButton item={item} />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs mt-auto border-t border-[#1e2d42] pt-2.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#8ba0b2]">Artist:</span>
                      <span
                        className="font-bold text-white truncate max-w-[130px]"
                        title={item.artistName}
                      >
                        {item.artistName || "Unknown"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#8ba0b2]">Translator:</span>
                      <span
                        className="text-[#3db4f2] font-semibold truncate max-w-[130px]"
                        title={formatHandle(item.translatorHandle)}
                      >
                        {formatHandle(item.translatorHandle)}
                      </span>
                    </div>

                    <a
                      href={`https://x.com/i/status/${item.tweetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-1.5 mt-2 rounded bg-[#0b1622] hover:bg-[#1a2638] text-[#8ba0b2] hover:text-[#3db4f2] text-[11px] font-bold transition-all duration-150 border border-[#27364b] hover:border-[#3db4f2]/60 active:scale-95 cursor-pointer"
                    >
                      View on X ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reading History Tab Content */}
      {activeTab === "history" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-[#8ba0b2]">
              Showing recently opened comics ({history.length} records)
            </span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
              >
                Clear History
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-24 bg-[#151f2e] rounded-2xl border border-[#1e2d42] px-4">
              <p className="text-base font-semibold text-white">
                No reading history yet
              </p>
              <p className="text-xs text-[#8ba0b2] mt-1">
                Comics you open to read will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 items-start">
              {history.map((item) => (
                <div
                  key={item.tweetId}
                  className="flex flex-col bg-[#151f2e] rounded-xl overflow-hidden border border-[#1e2d42] hover:border-[#3db4f2]/70 transition-all duration-200 shadow-md p-3 group"
                >
                  <div className="relative w-full aspect-[3/4] mb-3 overflow-hidden rounded-lg bg-[#0b1622] border border-[#1e2d42]/40 shrink-0">
                    {item.coverImage ? (
                      <Image
                        src={item.coverImage}
                        alt={item.title || "Comic cover"}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-[#5a6f82]">
                        No preview
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs mt-auto border-t border-[#1e2d42] pt-2.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#8ba0b2]">Artist:</span>
                      <span className="font-bold text-white truncate max-w-[130px]">
                        {item.artistName || "Unknown"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#8ba0b2]">Translator:</span>
                      <span className="text-[#3db4f2] font-semibold truncate max-w-[130px]">
                        {formatHandle(item.translatorHandle)}
                      </span>
                    </div>

                    <a
                      href={`https://x.com/i/status/${item.tweetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-1.5 mt-2 rounded bg-[#0b1622] hover:bg-[#1a2638] text-[#8ba0b2] hover:text-[#3db4f2] text-[11px] font-bold transition-all duration-150 border border-[#27364b] hover:border-[#3db4f2]/60 active:scale-95 cursor-pointer"
                    >
                      Read Again on X ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
