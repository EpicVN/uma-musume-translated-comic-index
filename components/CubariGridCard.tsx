"use client";

import { CubariChapter, CubariData } from "@/lib/reader";
import Image from "next/image";
import { useState, useEffect } from "react";

interface CubariGridCardProps {
  data: CubariData;
  link: string;
  priority?: boolean;
}

export default function CubariGridCard({
  data,
  link,
  priority = false,
}: CubariGridCardProps) {
  const [isOpenModal, setIsOpenModal] = useState(false);

  // Handle Escape key to close modal and prevent background scrolling when modal is open
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

  const chapters = Object.entries(data.chapters);
  const latestChapter: CubariChapter | undefined = chapters.at(-1)?.[1];

  const formattedDate = latestChapter
    ? new Date(Number(latestChapter.last_updated) * 1000).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        },
      )
    : null;

  return (
    <>
      {/* 1. Manga Preview Card */}
      <div className="flex flex-col bg-[#151f2e] rounded-xl overflow-hidden border border-[#1e2d42] hover:border-[#3db4f2]/70 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-[#3db4f2]/10 p-3">
        {/* Header Tag & Date */}
        <div className="flex items-center justify-between gap-1 text-[10px] pb-2 border-b border-[#1e2d42]/60 shrink-0 h-7">
          <span
            className="font-bold text-white truncate max-w-30"
            title={data.title}
          >
            {data.title}
          </span>
          {formattedDate && (
            <span className="text-[#5a6f82] font-semibold shrink-0 ml-1">
              {formattedDate}
            </span>
          )}
        </div>

        {/* Manga Preview - Cố định aspect-[3/4] chống nhảy layout */}
        <div
          className="relative w-full aspect-3/4 my-2 overflow-hidden rounded-lg bg-[#0b1622] cursor-pointer group flex items-center justify-center border border-[#1e2d42]/40 shrink-0"
          onClick={() => window.open(link, "_blank")}
        >
          {data.cover ? (
            <Image
              src={data.cover}
              alt={`Cover page of ${data.title}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              referrerPolicy="no-referrer"
              className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="text-zinc-500 text-xs px-3 text-center">
              No image preview available
            </div>
          )}

          {/* Page Badge */}
          <span className="absolute top-2 right-2 bg-black/75 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/10 z-10">
            {chapters.length}
          </span>

          {/* Hover Overlay */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-[#0b1622] via-[#0b1622]/60 to-transparent flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            <span className="text-[11px] font-semibold text-[#3db4f2] bg-[#0b1622]/90 px-3 py-1 rounded-full border border-[#3db4f2]/40 shadow-md">
              📖 Click to read
            </span>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="pt-2 border-t border-[#1e2d42] space-y-1.5 shrink-0 text-xs mt-auto">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#8ba0b2]">Artist:</span>
            <span
              className="font-bold text-white truncate max-w-30"
              title={data.artist}
            >
              {data.artist}
            </span>
          </div>

          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#8ba0b2]">Author:</span>
            <span className="text-[#3db4f2] font-semibold truncate max-w-30">
              {data.author}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => window.open(link, "_blank")}
              className="w-full py-1.5 rounded bg-[#22334a] hover:bg-[#3db4f2] text-zinc-200 hover:text-white text-[11px] font-bold transition-all duration-150 border border-[#2d4260] hover:border-[#3db4f2] shadow-sm active:scale-95 cursor-pointer"
            >
              Read on Cubari
            </button>
            <button
              type="button"
              onClick={() => setIsOpenModal(true)}
              className="w-full py-1.5 rounded bg-[#22334a] hover:bg-[#3db4f2] text-zinc-200 hover:text-white text-[11px] font-bold transition-all duration-150 border border-[#2d4260] hover:border-[#3db4f2] shadow-sm active:scale-95 cursor-pointer"
            >
              Description
            </button>
          </div>
        </div>
      </div>

      {/* 2. Full Story Modal */}
      {isOpenModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6"
          onClick={() => setIsOpenModal(false)}
        >
          <div
            className="bg-[#151f2e] border border-[#1e2d42] rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-row overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col w-full items-start justify-start gap-5 p-5 overflow-y-auto scrollbar-thin scrollbar-thumb-[#3db4f2]/40 scrollbar-track-transparent">
              {/* Modal Header */}
              <div className="sticky top-0 z-20 flex w-full justify-between px-5 py-3 bg-[#151f2e]/95 backdrop-blur-md border-b border-[#22334a] shrink-0 gap-3">
                <div className="flex flex-row gap-2 min-w-0">
                  <div className="flex flex-col gap-2">
                    <span className="text-white font-bold text-sm sm:text-base tracking-wide shrink-0">
                      {data.title}
                    </span>

                    {/* Artist & Translator Badge */}
                    <div className="inline-flex items-center gap-1.5 bg-[#0b1622] px-2.5 py-1 rounded-md border border-[#27364b] text-xs shrink-0 w-fit">
                      <span
                        className="text-[#8ba0b2] font-medium truncate max-w-35 sm:max-w-50"
                        title="Chapter count"
                      >
                        {chapters.length} Chapters
                      </span>
                      <span className="text-[#3db4f2] font-bold shrink-0">
                        ➔ Latest Chapter:
                      </span>
                      <span className="text-[#3db4f2] font-semibold shrink-0">
                        {latestChapter?.title || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsOpenModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0b1622] text-[#8ba0b2] hover:text-white hover:bg-rose-600 border border-[#27364b] hover:border-rose-500 transition-colors duration-150 cursor-pointer text-xs font-bold shrink-0 ml-2"
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>
              <div>{data.description}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
