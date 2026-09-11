"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Tweet } from "react-tweet";
import { useReadingTracker } from "@/hooks/useReadingTracker";

export interface ComicPostItem {
  id: string;
  origId: string;
  transId: string;
  artistName: string;
  translatorName: string;
  language?: string | null;
  postedAt: Date | string;
  origMediaUrls: string[];
  transMediaUrls: string[];
  tags: { id: string; name: string; slug: string }[];
}

interface ReaderModalProps {
  post: ComicPostItem | null;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

function formatHandle(handle?: string) {
  if (!handle) return "";
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export default function ReaderModal({
  post,
  isOpen,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}: ReaderModalProps) {
  const { recordProgress } = useReadingTracker();

  // Mobile viewport tab mode: 'trans' | 'raw' | 'both'
  const [mobileTab, setMobileTab] = useState<"trans" | "raw" | "both">("trans");

  // Touch swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || !post) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const totalPages =
      post.transMediaUrls.length > 0
        ? post.transMediaUrls.length
        : post.origMediaUrls.length > 0
          ? post.origMediaUrls.length
          : 1;

    recordProgress({
      tweetId: post.transId,
      title: `${post.artistName} (TL by ${formatHandle(post.translatorName)})`,
      coverImage: post.transMediaUrls[0] || post.origMediaUrls[0] || undefined,
      artistName: post.artistName,
      translatorHandle: post.translatorName,
      lastReadPageIndex: 0,
      totalPages,
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName))
        return;

      if (e.key === "ArrowRight") {
        if (hasNext) {
          e.preventDefault();
          onNext();
        }
      } else if (e.key === "ArrowLeft") {
        if (hasPrev) {
          e.preventDefault();
          onPrev();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, post, hasNext, hasPrev, onNext, onPrev, onClose, recordProgress]);

  // Touch gesture handlers for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Detect horizontal swipe while avoiding conflict with vertical scrolling
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0 && hasNext) {
        onNext();
      } else if (deltaX > 0 && hasPrev) {
        onPrev();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (!isOpen || !post) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm sm:p-4 md:p-6"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Previous Comic Button (Desktop) */}
      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="fixed left-3 sm:left-5 top-1/2 -translate-y-1/2 z-60 p-3 rounded-full bg-[#151f2e]/90 hover:bg-[#3db4f2] text-[#8ba0b2] hover:text-white border border-[#27364b] hover:border-[#3db4f2] transition-all duration-150 shadow-2xl active:scale-90 cursor-pointer hidden sm:flex items-center justify-center group"
          title="Previous Comic (←)"
        >
          <svg
            className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform"
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
        </button>
      )}

      {/* Next Comic Button (Desktop) */}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-60 p-3 rounded-full bg-[#151f2e]/90 hover:bg-[#3db4f2] text-[#8ba0b2] hover:text-white border border-[#27364b] hover:border-[#3db4f2] transition-all duration-150 shadow-2xl active:scale-90 cursor-pointer hidden sm:flex items-center justify-center group"
          title="Next Comic (→)"
        >
          <svg
            className="w-5 h-5 group-hover:translate-x-0.5 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {/* Modal Dialog Container */}
      <div
        className="bg-[#0b1622] sm:bg-[#151f2e] border-0 sm:border border-[#1e2d42] sm:rounded-2xl max-w-5xl w-full h-full sm:h-auto sm:max-h-[94vh] flex flex-col overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-30 flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 bg-[#151f2e]/95 backdrop-blur-md border-b border-[#22334a] shrink-0 gap-2">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2 truncate max-w-[82vw] sm:max-w-none">
              <span className="text-white font-bold text-sm tracking-wide truncate">
                {post.artistName}
              </span>
              <span className="text-[#3db4f2] font-semibold text-xs truncate">
                ➔ {formatHandle(post.translatorName)}
              </span>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#8ba0b2] hover:text-white bg-[#0b1622] sm:hidden border border-[#27364b]"
              aria-label="Close modal"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Quick Segment Control for Mobile View */}
          <div className="flex sm:hidden items-center justify-between w-full bg-[#070d14] p-0.5 rounded-lg border border-[#1e2d42]">
            <button
              type="button"
              onClick={() => setMobileTab("trans")}
              className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                mobileTab === "trans"
                  ? "bg-[#10b981] text-white shadow-sm"
                  : "text-[#8ba0b2] hover:text-white"
              }`}
            >
              Translated ({(post.language || "EN").toUpperCase()})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("raw")}
              className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                mobileTab === "raw"
                  ? "bg-[#f43f5e] text-white shadow-sm"
                  : "text-[#8ba0b2] hover:text-white"
              }`}
            >
              Original Raw
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("both")}
              className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                mobileTab === "both"
                  ? "bg-[#3db4f2] text-white shadow-sm"
                  : "text-[#8ba0b2] hover:text-white"
              }`}
            >
              Both
            </button>
          </div>

          {/* Desktop Header Actions */}
          <div className="hidden sm:flex items-center gap-2">
            <a
              href={`https://x.com/i/status/${post.transId}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold px-2.5 py-1 rounded bg-[#0b1622] text-[#8ba0b2] hover:text-[#3db4f2] border border-[#27364b] transition-colors"
            >
              View on X ↗
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8ba0b2] hover:text-white hover:bg-[#22334a] transition-colors"
              aria-label="Close reader"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Reader Body with generous bottom padding for mobile floating dock */}
        <div className="overflow-y-auto p-2.5 sm:p-5 flex-1 pb-32 sm:pb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
            {/* Raw Column */}
            <div
              className={`flex flex-col items-center w-full ${
                mobileTab === "trans" ? "hidden md:flex" : "flex"
              }`}
            >
              <div
                className={`w-full justify-between items-center mb-1.5 px-1 text-xs ${
                  mobileTab !== "both" ? "hidden md:flex" : "flex"
                }`}
              >
                <span className="font-bold text-[#f43f5e] uppercase tracking-wide">
                  Original Raw
                </span>
                <a
                  href={`https://x.com/i/status/${post.origId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8ba0b2] hover:text-[#3db4f2] font-medium text-[11px]"
                >
                  Open on X ↗
                </a>
              </div>

              {post.origMediaUrls.length > 0 ? (
                <div className="flex flex-col gap-2.5 sm:gap-3 w-full max-w-105">
                  {post.origMediaUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-full rounded-xl overflow-hidden border border-[#1e2d42] bg-[#070d14] shadow-sm"
                    >
                      <Image
                        src={url}
                        alt={`Original art page ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-auto object-contain block select-none"
                        width={0}
                        height={0}
                        sizes="(max-width: 768px) 100vw, 420px"
                        style={{ width: "100%", height: "auto" }}
                        loading="lazy"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="w-full max-w-105 [data-theme='dark'] [&_.react-tweet-theme]:bg-[#0b1622]! [&_.react-tweet-theme]:border-[#1e2d42]! [&_.react-tweet-theme]:rounded-lg!"
                  data-theme="dark"
                >
                  <Tweet id={post.origId} />
                </div>
              )}
            </div>

            {/* Translated Column */}
            <div
              className={`flex flex-col items-center w-full ${
                mobileTab === "raw" ? "hidden md:flex" : "flex"
              }`}
            >
              <div
                className={`w-full justify-between items-center mb-1.5 px-1 text-xs ${
                  mobileTab !== "both" ? "hidden md:flex" : "flex"
                }`}
              >
                <span className="font-bold text-[#10b981] uppercase tracking-wide">
                  Translated ({(post.language || "EN").toUpperCase()})
                </span>
                <a
                  href={`https://x.com/i/status/${post.transId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8ba0b2] hover:text-[#3db4f2] font-medium text-[11px]"
                >
                  Open on X ↗
                </a>
              </div>

              {post.transMediaUrls.length > 0 ? (
                <div className="flex flex-col gap-2.5 sm:gap-3 w-full max-w-105">
                  {post.transMediaUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-full rounded-xl overflow-hidden border border-[#1e2d42] bg-[#070d14] shadow-sm"
                    >
                      <Image
                        src={url}
                        alt={`Translated page ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-auto object-contain block select-none"
                        width={0}
                        height={0}
                        sizes="(max-width: 768px) 100vw, 420px"
                        style={{ width: "100%", height: "auto" }}
                        loading="lazy"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="w-full max-w-105 [data-theme='dark'] [&_.react-tweet-theme]:bg-[#0b1622]! [&_.react-tweet-theme]:border-[#1e2d42]! [&_.react-tweet-theme]:rounded-lg! [&_.react-tweet-theme_.react-tweet-quoted-tweet]:hidden!"
                  data-theme="dark"
                >
                  <Tweet id={post.transId} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Floating Mobile Bottom Dock (Elevated above system gesture bars & corner buttons) */}
        <div className="sm:hidden fixed bottom-4 inset-x-3 z-50 bg-[#151f2e]/90 backdrop-blur-lg border border-[#27364b] p-2 rounded-2xl flex items-center justify-between gap-2.5 shadow-2xl ring-1 ring-black/40">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={onPrev}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#0b1622] hover:bg-[#1a2638] disabled:opacity-30 border border-[#27364b] text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Prev Comic
          </button>

          <span className="text-[10px] uppercase font-bold text-[#8ba0b2] shrink-0 tracking-wider">
            Swipe ⟷
          </span>

          <button
            type="button"
            disabled={!hasNext}
            onClick={onNext}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#3db4f2] hover:bg-[#359ed4] disabled:opacity-30 disabled:bg-[#0b1622] text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            Next Comic
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
