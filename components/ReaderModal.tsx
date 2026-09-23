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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050b14]/90 backdrop-blur-md sm:p-6 md:p-8"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ================= NÚT ĐIỀU HƯỚNG BÊN NGOÀI (Desktop) ================= */}
      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="fixed left-6 top-1/2 -translate-y-1/2 z-60 w-14 h-14 rounded-full bg-white/5 backdrop-blur-md hover:bg-[#3db4f2]/20 text-[#8ba0b2] hover:text-[#3db4f2] border border-white/10 hover:border-[#3db4f2]/50 transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(61,180,242,0.4)] active:scale-90 cursor-pointer hidden sm:flex items-center justify-center group"
          title="Previous Comic (←)"
        >
          <svg
            className="w-6 h-6 group-hover:-translate-x-1 transition-transform"
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

      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="fixed right-6 top-1/2 -translate-y-1/2 z-60 w-14 h-14 rounded-full bg-white/5 backdrop-blur-md hover:bg-[#3db4f2]/20 text-[#8ba0b2] hover:text-[#3db4f2] border border-white/10 hover:border-[#3db4f2]/50 transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(61,180,242,0.4)] active:scale-90 cursor-pointer hidden sm:flex items-center justify-center group"
          title="Next Comic (→)"
        >
          <svg
            className="w-6 h-6 group-hover:translate-x-1 transition-transform"
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

      {/* ================= KHUNG MODAL CHÍNH ================= */}
      <div
        className="bg-[#0f1724]/95 backdrop-blur-xl border-0 sm:border border-[#1e2d42]/80 sm:rounded-4xl max-w-6xl w-full h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] relative ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-30 flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 bg-linear-to-b from-[#0a111a] to-[#0a111a]/80 backdrop-blur-md border-b border-[#1e2d42] shrink-0 gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto">
            {/* Credits HUD (Game Style) */}
            <div className="flex items-center gap-3 truncate">
              {/* Artist */}
              <div className="flex items-center gap-1.5 drop-shadow-md">
                <span className="text-[9px] font-black tracking-widest bg-linear-to-r from-[#f43f5e] to-[#be123c] text-white px-2 py-0.5 rounded shadow-sm shrink-0">
                  ART
                </span>
                <span className="text-[13px] font-bold text-white truncate max-w-30 sm:max-w-50">
                  {post.artistName}
                </span>
              </div>

              <svg
                className="w-4 h-4 text-[#3db4f2] opacity-60 shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Translator */}
              <div className="flex items-center gap-1.5 drop-shadow-md">
                <span className="text-[9px] font-black tracking-widest bg-linear-to-r from-[#eab308] to-[#ca8a04] text-white px-2 py-0.5 rounded shadow-sm shrink-0">
                  TL
                </span>
                <span className="text-[13px] font-bold text-[#e2e8f0] truncate max-w-30 sm:max-w-50">
                  {formatHandle(post.translatorName)}
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#8ba0b2] hover:text-white bg-white/5 sm:hidden border border-white/10"
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
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Quick Segment Control for Mobile View */}
          <div className="flex sm:hidden items-center justify-between w-full bg-[#050b14] p-1 rounded-xl border border-[#1e2d42] shadow-inner">
            <button
              type="button"
              onClick={() => setMobileTab("trans")}
              className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                mobileTab === "trans"
                  ? "bg-linear-to-r from-[#10b981] to-[#059669] text-white shadow-md"
                  : "text-[#64748b]"
              }`}
            >
              Trans
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("raw")}
              className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                mobileTab === "raw"
                  ? "bg-linear-to-r from-[#f43f5e] to-[#be123c] text-white shadow-md"
                  : "text-[#64748b]"
              }`}
            >
              Raw
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("both")}
              className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                mobileTab === "both"
                  ? "bg-linear-to-r from-[#3db4f2] to-[#2563eb] text-white shadow-md"
                  : "text-[#64748b]"
              }`}
            >
              Both
            </button>
          </div>

          {/* Desktop Header Actions */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href={`https://x.com/i/status/${post.transId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-[#3db4f2]/20 text-[#8ba0b2] hover:text-[#3db4f2] text-[10px] font-black tracking-widest uppercase transition-all border border-white/10 hover:border-[#3db4f2]/50 shadow-sm"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              View on X
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#64748b] hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/30"
              title="Close (Esc)"
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
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ================= NỘI DUNG ĐỌC TRUYỆN ================= */}
        <div className="overflow-y-auto overflow-x-hidden p-3 sm:p-6 flex-1 pb-32 sm:pb-6 custom-scrollbar bg-[#0f1724]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 items-start max-w-7xl mx-auto">
            {/* --- COLUMN 1: ORIGINAL RAW --- */}
            <div
              className={`flex flex-col items-center w-full ${mobileTab === "trans" ? "hidden md:flex" : "flex"}`}
            >
              {/* Header Cột */}
              <div
                className={`w-full justify-between items-center mb-3 px-2 ${mobileTab !== "both" ? "hidden md:flex" : "flex"}`}
              >
                <span className="font-black text-[11px] text-[#f43f5e] uppercase tracking-widest bg-[#f43f5e]/10 px-3 py-1 rounded-full border border-[#f43f5e]/20">
                  Original Raw
                </span>
                <a
                  href={`https://x.com/i/status/${post.origId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#64748b] hover:text-white font-black text-[9px] uppercase tracking-widest transition-colors flex items-center gap-1"
                >
                  Open on X{" "}
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>

              {post.origMediaUrls.length > 0 ? (
                <div className="flex flex-col gap-4 sm:gap-6 w-full max-w-lg">
                  {post.origMediaUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-full rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/10 group bg-[#050b14]"
                    >
                      <Image
                        src={url}
                        alt={`Original art page ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-auto object-contain block select-none"
                        width={0}
                        height={0}
                        sizes="(max-width: 768px) 100vw, 500px"
                        style={{ width: "100%", height: "auto" }}
                        loading="lazy"
                        unoptimized
                      />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white/50 text-[10px] font-black px-2 py-0.5 rounded-lg border border-white/10 pointer-events-none">
                        P.{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="w-full max-w-lg [data-theme='dark'] [&_.react-tweet-theme]:bg-[#050b14]! [&_.react-tweet-theme]:border-white/10! [&_.react-tweet-theme]:rounded-2xl!"
                  data-theme="dark"
                >
                  <Tweet id={post.origId} />
                </div>
              )}
            </div>

            {/* --- COLUMN 2: TRANSLATED --- */}
            <div
              className={`flex flex-col items-center w-full ${mobileTab === "raw" ? "hidden md:flex" : "flex"}`}
            >
              {/* Header Cột */}
              <div
                className={`w-full justify-between items-center mb-3 px-2 ${mobileTab !== "both" ? "hidden md:flex" : "flex"}`}
              >
                <span className="font-black text-[11px] text-[#3db4f2] uppercase tracking-widest bg-[#3db4f2]/10 px-3 py-1 rounded-full border border-[#3db4f2]/20">
                  Translated ({(post.language || "EN").toUpperCase()})
                </span>
                <a
                  href={`https://x.com/i/status/${post.transId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#64748b] hover:text-white font-black text-[9px] uppercase tracking-widest transition-colors flex items-center gap-1"
                >
                  Open on X{" "}
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>

              {post.transMediaUrls.length > 0 ? (
                <div className="flex flex-col gap-4 sm:gap-6 w-full max-w-lg">
                  {post.transMediaUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-full rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/10 group bg-[#050b14]"
                    >
                      <Image
                        src={url}
                        alt={`Translated page ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-auto object-contain block select-none"
                        width={0}
                        height={0}
                        sizes="(max-width: 768px) 100vw, 500px"
                        style={{ width: "100%", height: "auto" }}
                        loading="lazy"
                        unoptimized
                      />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-[#3db4f2]/50 text-[10px] font-black px-2 py-0.5 rounded-lg border border-white/10 pointer-events-none">
                        P.{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="w-full max-w-lg [data-theme='dark'] [&_.react-tweet-theme]:bg-[#050b14]! [&_.react-tweet-theme]:border-white/10! [&_.react-tweet-theme]:rounded-2xl! [&_.react-tweet-theme_.react-tweet-quoted-tweet]:hidden!"
                  data-theme="dark"
                >
                  <Tweet id={post.transId} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= FLOATING MOBILE BOTTOM DOCK ================= */}
        <div className="sm:hidden fixed bottom-4 inset-x-3 z-70 bg-[#0a111a]/95 backdrop-blur-xl border border-[#1e2d42] p-2 rounded-2xl flex items-center justify-between gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.8)] ring-1 ring-white/5">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={onPrev}
            className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 text-white font-black text-[11px] tracking-widest uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"
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
            PREV
          </button>

          <span className="text-[9px] uppercase font-black text-[#64748b] shrink-0 tracking-[0.2em] px-2">
            Swipe ⟷
          </span>

          <button
            type="button"
            disabled={!hasNext}
            onClick={onNext}
            className="flex-1 py-2.5 px-3 rounded-xl bg-linear-to-r from-[#3db4f2] to-[#2563eb] disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 text-white font-black text-[11px] tracking-widest uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_15px_rgba(61,180,242,0.4)] disabled:shadow-none"
          >
            NEXT
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

      {/* Global CSS for Custom Scrollbar in Reader Modal */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e2d42;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3db4f2;
        }
      `,
        }}
      />
    </div>
  );
}
