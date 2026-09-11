"use client";

import { useEffect } from "react";
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

  // Khóa cuộn trang khi mở modal và lắng nghe phím tắt điều hướng
  useEffect(() => {
    if (!isOpen || !post) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Tự động ghi nhận lịch sử đọc truyện
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
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

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

  if (!isOpen || !post) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      {/* Nút Prev Comic Desktop (Cố định mép trái) */}
      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="fixed left-2 sm:left-5 top-1/2 -translate-y-1/2 z-60 p-3 rounded-full bg-[#151f2e]/90 hover:bg-[#3db4f2] text-[#8ba0b2] hover:text-white border border-[#27364b] hover:border-[#3db4f2] transition-all duration-150 shadow-2xl active:scale-90 cursor-pointer hidden sm:flex items-center justify-center group"
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

      {/* Nút Next Comic Desktop (Cố định mép phải) */}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="fixed right-2 sm:right-5 top-1/2 -translate-y-1/2 z-60 p-3 rounded-full bg-[#151f2e]/90 hover:bg-[#3db4f2] text-[#8ba0b2] hover:text-white border border-[#27364b] hover:border-[#3db4f2] transition-all duration-150 shadow-2xl active:scale-90 cursor-pointer hidden sm:flex items-center justify-center group"
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

      {/* Khung Modal Container */}
      <div
        className="bg-[#151f2e] border border-[#1e2d42] rounded-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-5 py-3 bg-[#151f2e]/95 backdrop-blur-md border-b border-[#22334a] shrink-0 gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            <span className="text-white font-bold text-sm sm:text-base tracking-wide shrink-0">
              Uma Musume Translation
            </span>

            <div className="inline-flex items-center gap-1.5 bg-[#0b1622] px-2.5 py-1 rounded-md border border-[#27364b] text-xs shrink-0">
              <span
                className="text-[#8ba0b2] font-medium truncate max-w-36 sm:max-w-52"
                title={post.artistName}
              >
                {post.artistName}
              </span>
              <span className="text-[#3db4f2] font-bold shrink-0">➔</span>
              <span className="text-[#3db4f2] font-semibold shrink-0">
                {formatHandle(post.translatorName)}
              </span>
            </div>

            {post.tags.length > 0 && (
              <div className="hidden sm:flex flex-wrap items-center gap-1.5">
                {post.tags.map((t) => (
                  <span
                    key={t.id}
                    className="text-[11px] font-bold bg-[#0b1622] text-[#3db4f2] px-2 py-0.5 rounded border border-[#27364b]"
                  >
                    #{t.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Next/Prev buttons for mobile */}
            <div className="flex items-center gap-1 sm:hidden">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={onPrev}
                className="px-2.5 py-1 text-xs rounded bg-[#0b1622] text-[#8ba0b2] disabled:opacity-30 border border-[#27364b]"
              >
                ←
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={onNext}
                className="px-2.5 py-1 text-xs rounded bg-[#0b1622] text-[#8ba0b2] disabled:opacity-30 border border-[#27364b]"
              >
                →
              </button>
            </div>

            {/* Nút đóng Modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8ba0b2] hover:text-white hover:bg-[#22334a] transition-colors"
              aria-label="Close"
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

        {/* Modal 2-Column Content */}
        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Cột 1: Raw Tweet Gốc */}
            <div className="flex flex-col items-center w-full">
              <div className="w-full flex justify-between items-center mb-2 px-1 text-xs">
                <span className="font-bold text-[#f43f5e] uppercase tracking-wide">
                  Original Raw
                </span>
                <a
                  href={`https://x.com/i/status/${post.origId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8ba0b2] hover:text-[#3db4f2] transition font-medium text-[11px]"
                >
                  Open on X ↗
                </a>
              </div>

              {post.origMediaUrls.length > 0 ? (
                <div className="flex flex-col gap-3 w-full max-w-105">
                  {post.origMediaUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-full rounded-xl overflow-hidden border border-[#1e2d42] bg-[#0b1622] shadow-sm"
                    >
                      <Image
                        src={url}
                        alt={`Original art page ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-auto object-contain block"
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

            {/* Cột 2: Translated Tweet Đã Dịch */}
            <div className="flex flex-col items-center w-full">
              <div className="w-full flex justify-between items-center mb-2 px-1 text-xs">
                <span className="font-bold text-[#10b981] uppercase tracking-wide">
                  Translated ({(post.language || "EN").toUpperCase()})
                </span>
                <a
                  href={`https://x.com/i/status/${post.transId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8ba0b2] hover:text-[#3db4f2] transition font-medium text-[11px]"
                >
                  Open on X ↗
                </a>
              </div>

              {post.transMediaUrls.length > 0 ? (
                <div className="flex flex-col gap-3 w-full max-w-105">
                  {post.transMediaUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-full rounded-xl overflow-hidden border border-[#1e2d42] bg-[#0b1622] shadow-sm"
                    >
                      <Image
                        src={url}
                        alt={`Translated page ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-auto object-contain block"
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
      </div>
    </div>
  );
}
