"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { Tweet, useTweet } from "react-tweet";

interface TagItem {
  id: string;
  name: string;
  jpName?: string | null;
}

interface TweetGridCardProps {
  origId: string;
  transId: string;
  artistName: string;
  translatorName: string;
  language: string;
  tags?: TagItem[];
  postedAt?: Date | string;
  priority?: boolean;
}

function formatHandle(handle: string) {
  if (!handle) return "";
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export default function TweetGridCard({
  origId,
  transId,
  artistName,
  translatorName,
  language,
  tags = [],
  postedAt,
  priority = false,
}: TweetGridCardProps) {
  const [isOpenModal, setIsOpenModal] = useState(false);

  // Lấy dữ liệu bài tweet dịch để bóc tách trực tiếp ảnh đầu tiên
  const { data: tweet, isLoading } = useTweet(transId);

  // Khóa cuộn trang nền và lắng nghe phím ESC khi modal mở
  useEffect(() => {
    if (!isOpenModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpenModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpenModal]);

  const formattedDate = postedAt
    ? new Date(postedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // Lấy URL ảnh manga đầu tiên
  const firstPhotoUrl =
    tweet?.mediaDetails && tweet.mediaDetails.length > 0
      ? tweet.mediaDetails[0].media_url_https
      : null;

  return (
    <>
      {/* 1. Card Manga Ngoài Grid */}
      <div className="flex flex-col h-130 bg-[#151f2e] rounded-xl overflow-hidden border border-[#1e2d42] hover:border-[#3db4f2]/70 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-[#3db4f2]/10 p-3">
        {/* Header Tag & Date */}
        <div className="flex items-center justify-between gap-1 text-[10px] pb-2 border-b border-[#1e2d42]/60 shrink-0">
          <div className="flex flex-wrap gap-1 overflow-hidden h-5">
            {tags.length > 0 ? (
              tags.slice(0, 1).map((t) => (
                <span
                  key={t.id}
                  className="font-bold bg-[#0b1622] text-[#3db4f2] px-1.5 py-0.5 rounded border border-[#27364b] truncate max-w-32.5"
                >
                  {t.name}
                </span>
              ))
            ) : (
              <span className="text-[#8ba0b2] bg-[#0b1622] px-1.5 py-0.5 rounded border border-[#27364b]">
                Uma Musume
              </span>
            )}
          </div>
          {formattedDate && (
            <span className="text-[#5a6f82] font-semibold shrink-0">
              {formattedDate}
            </span>
          )}
        </div>

        {/* Khung tranh Manga ngoài Grid */}
        <div
          className="relative flex-1 w-full my-2 overflow-hidden rounded-lg bg-[#0b1622] cursor-pointer group flex items-center justify-center border border-[#1e2d42]/40"
          onClick={() => setIsOpenModal(true)}
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <div className="w-5 h-5 border-2 border-[#3db4f2] border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px]">Loading art...</span>
            </div>
          ) : firstPhotoUrl ? (
            <Image
              src={firstPhotoUrl}
              alt="Manga Preview"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              priority={priority}
              className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="text-zinc-500 text-xs px-3 text-center">
              No image preview available
            </div>
          )}

          {/* Badge báo số trang */}
          {tweet?.mediaDetails && tweet.mediaDetails.length > 1 && (
            <span className="absolute top-2 right-2 bg-black/75 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/10">
              1/{tweet.mediaDetails.length} P
            </span>
          )}

          {/* Lớp phủ hover mở đọc nhanh */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-[#0b1622] via-[#0b1622]/60 to-transparent flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <span className="text-[11px] font-semibold text-[#3db4f2] bg-[#0b1622]/90 px-3 py-1 rounded-full border border-[#3db4f2]/40 shadow-md">
              📖 Click to read
            </span>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="pt-2 border-t border-[#1e2d42] space-y-1.5 shrink-0 text-xs">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#8ba0b2]">Artist:</span>
            <span
              className="font-bold text-white truncate max-w-30"
              title={artistName}
            >
              {artistName}
            </span>
          </div>

          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#8ba0b2]">Translator:</span>
            <span className="text-[#3db4f2] font-semibold truncate max-w-30">
              {formatHandle(translatorName)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsOpenModal(true)}
              className="w-full py-1.5 rounded bg-[#22334a] hover:bg-[#3db4f2] text-zinc-200 hover:text-white text-[11px] font-bold transition-all duration-150 border border-[#2d4260] hover:border-[#3db4f2] shadow-sm active:scale-95 cursor-pointer"
            >
              Read
            </button>
            <a
              href={`https://x.com/i/status/${transId}`}
              target="_blank"
              rel="noreferrer"
              className="w-full text-center py-1.5 rounded bg-[#0b1622] hover:bg-[#1a2638] text-[#8ba0b2] hover:text-[#3db4f2] text-[11px] font-bold transition-all duration-150 border border-[#27364b] hover:border-[#3db4f2]/60 active:scale-95 cursor-pointer"
            >
              View on X ↗
            </a>
          </div>
        </div>
      </div>

      {/* 2. Modal Popup Đọc Truyện Đầy Đủ */}
      {isOpenModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6"
          onClick={() => setIsOpenModal(false)}
        >
          <div
            className="bg-[#151f2e] border border-[#1e2d42] rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Cố Định */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3.5 bg-[#151f2e]/95 backdrop-blur-md border-b border-[#22334a] shrink-0">
              <div className="flex flex-wrap items-center gap-2.5 min-w-0 pr-2">
                <span className="text-white font-bold text-sm sm:text-base tracking-wide shrink-0">
                  Uma Musume Translation
                </span>
                <div className="inline-flex items-center gap-1.5 bg-[#0b1622] px-2.5 py-1 rounded-md border border-[#27364b] text-xs min-w-0">
                  <span
                    className="text-[#8ba0b2] font-medium truncate max-w-35 sm:max-w-50"
                    title={artistName}
                  >
                    {artistName}
                  </span>
                  <span className="text-[#3db4f2] font-bold shrink-0">➔</span>
                  <span className="text-[#3db4f2] font-semibold shrink-0">
                    {formatHandle(translatorName)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0b1622] text-[#8ba0b2] hover:text-white hover:bg-rose-600 border border-[#27364b] hover:border-rose-500 transition-colors duration-150 cursor-pointer text-xs font-bold shrink-0"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Khung cuộn hiển thị song song Raw & Translated */}
            <div className="overflow-y-auto p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Raw Tweet */}
                <div className="flex flex-col items-center">
                  <div className="w-full flex justify-between items-center mb-2 px-1 text-xs">
                    <span className="font-bold text-[#f43f5e] uppercase tracking-wide">
                      Original Raw
                    </span>
                    <a
                      href={`https://x.com/i/status/${origId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#8ba0b2] hover:text-[#3db4f2] transition font-medium text-[11px]"
                    >
                      Open on X ↗
                    </a>
                  </div>
                  <div
                    className="w-full max-w-105 [data-theme='dark'] [&_.react-tweet-theme]:bg-[#0b1622]! [&_.react-tweet-theme]:border-[#1e2d42]! [&_.react-tweet-theme]:rounded-lg!"
                    data-theme="dark"
                  >
                    <Tweet id={origId} />
                  </div>
                </div>

                {/* Translated Tweet */}
                <div className="flex flex-col items-center">
                  <div className="w-full flex justify-between items-center mb-2 px-1 text-xs">
                    <span className="font-bold text-[#10b981] uppercase tracking-wide">
                      Translated ({language.toUpperCase()})
                    </span>
                    <a
                      href={`https://x.com/i/status/${transId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#8ba0b2] hover:text-[#3db4f2] transition font-medium text-[11px]"
                    >
                      Open on X ↗
                    </a>
                  </div>
                  <div
                    className="w-full max-w-105 [data-theme='dark'] [&_.react-tweet-theme]:bg-[#0b1622]! [&_.react-tweet-theme]:border-[#1e2d42]! [&_.react-tweet-theme]:rounded-lg! [&_.react-tweet-theme_.react-tweet-quoted-tweet]:hidden!"
                    data-theme="dark"
                  >
                    <Tweet id={transId} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
