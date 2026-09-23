"use client";

import { CubariChapter, CubariData } from "@/lib/reader";
import Image from "next/image";
import { useState, useEffect } from "react";
import { format } from "date-fns";

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

  const formattedDate = latestChapter?.last_updated
    ? format(new Date(Number(latestChapter.last_updated) * 1000), "MMM d, yyyy")
    : null;

  return (
    <>
      {/* ================= 1. MANGA PREVIEW CARD (Edge-to-Edge) ================= */}
      <div className="group relative w-full aspect-3/4 bg-[#050b14] rounded-2xl overflow-hidden border border-[#1e2d42] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(61,180,242,0.25)] hover:border-[#3db4f2]/50 outline-none focus-visible:ring-2 focus-visible:ring-[#3db4f2]">
        {/* Khung ảnh Cubari tràn viền 100% */}
        <div
          className="absolute inset-0 w-full h-full cursor-pointer z-0"
          onClick={() => window.open(link, "_blank")}
        >
          {data.cover ? (
            <Image
              src={data.cover}
              alt={`Cover page of ${data.title}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              referrerPolicy="no-referrer"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-zinc-500 text-xs bg-[#0b1622] px-3 text-center">
              No preview available
            </div>
          )}

          {/* Overlay Hover "READ" (Glassmorphism) */}
          <div className="absolute inset-0 flex items-center justify-center bg-[#050b14]/30 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-all duration-300 pointer-events-none z-20">
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(61,180,242,0.3)] transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 ease-out">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <span className="text-[11px] font-black tracking-widest text-white">
                READ
              </span>
            </div>
          </div>

          {/* Gradient Đáy - Tăng chiều cao lên h-48 để chứa đủ 2 hàng button rõ ràng */}
          <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-[#050b14] via-[#050b14]/90 to-transparent pointer-events-none z-10"></div>
        </div>

        {/* ================= HEADER OVERLAY (Nổi trên đỉnh) ================= */}
        <div className="absolute top-0 inset-x-0 p-3 flex items-start justify-between z-20 bg-linear-to-b from-[#0a111a]/90 via-[#0a111a]/50 to-transparent pb-10 pointer-events-none">
          <span
            className="px-2 py-0.5 rounded-md bg-[#3db4f2]/20 border border-[#3db4f2]/40 text-[#3db4f2] text-[9px] font-black tracking-widest uppercase shadow-sm backdrop-blur-md transform -skew-x-6 truncate max-w-35"
            title={data.title}
          >
            <span className="block transform skew-x-6 truncate">
              {data.title}
            </span>
          </span>

          {formattedDate && (
            <span className="text-[9px] font-bold text-white/95 drop-shadow-md bg-black/60 px-1.5 py-0.5 rounded-md border border-white/10 shrink-0">
              {formattedDate}
            </span>
          )}
        </div>

        {/* ================= FOOTER OVERLAY (Nổi dưới đáy giống layout cũ nhưng style HUD) ================= */}
        <div className="absolute bottom-0 inset-x-0 p-3 flex flex-col gap-2.5 z-30 pointer-events-none mt-auto">
          {/* Credits */}
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1 min-w-0 pr-2">
              <div className="flex items-center gap-1.5 drop-shadow-md">
                <span className="text-[8px] font-black tracking-widest bg-linear-to-r from-[#f43f5e] to-[#be123c] text-white px-1.5 py-0.5 rounded shadow-sm shrink-0">
                  ART
                </span>
                <span
                  className="text-xs font-bold text-white truncate"
                  title={data.artist}
                >
                  {data.artist || "Unknown"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 drop-shadow-md">
                <span className="text-[8px] font-black tracking-widest bg-linear-to-r from-[#eab308] to-[#ca8a04] text-white px-1.5 py-0.5 rounded shadow-sm shrink-0">
                  AUTH
                </span>
                <span
                  className="text-xs font-bold text-[#e2e8f0] truncate"
                  title={data.author}
                >
                  {data.author || "Unknown"}
                </span>
              </div>
            </div>

            {/* Chapter Badge */}
            <div className="flex items-center gap-1 bg-black/60 border border-white/20 px-2 py-0.5 rounded-md backdrop-blur-md shadow-lg shrink-0">
              <span className="text-[9px] font-black text-[#3db4f2]">
                {chapters.length} CH
              </span>
            </div>
          </div>

          {/* Dòng Action Buttons (giống layout cũ: Read on Cubari + Description) */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/15 pointer-events-auto">
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 py-1.5 rounded-xl bg-white/10 hover:bg-[#3db4f2] text-white text-[10px] font-black tracking-wider uppercase transition-all duration-200 border border-white/15 hover:border-[#3db4f2] active:scale-95 shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              Read
            </a>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpenModal(true);
              }}
              className="flex items-center justify-center gap-1 py-1.5 rounded-xl bg-black/50 hover:bg-white/20 text-[#e2e8f0] text-[10px] font-black tracking-wider uppercase transition-all duration-200 border border-white/15 hover:border-white/40 active:scale-95 shadow-sm backdrop-blur-md cursor-pointer"
            >
              Description
            </button>
          </div>
        </div>
      </div>

      {/* ================= 2. FULL STORY MODAL ================= */}
      {isOpenModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#050b14]/90 backdrop-blur-md p-4 sm:p-6"
          onClick={() => setIsOpenModal(false)}
        >
          <div
            className="bg-[#0f1724]/95 backdrop-blur-xl border border-[#1e2d42]/80 rounded-4xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] ring-1 ring-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-linear-to-b from-[#0a111a] to-[#0a111a]/80 border-b border-[#1e2d42] shrink-0">
              <div className="flex flex-col gap-1 min-w-0 pr-4">
                <h3 className="text-white font-black text-base sm:text-lg tracking-wide truncate uppercase">
                  {data.title}
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#3db4f2] font-bold">
                    {chapters.length} Chapters
                  </span>
                  <span className="text-[#64748b]">•</span>
                  <span className="text-[#8ba0b2] truncate">
                    Latest: {latestChapter?.title || "N/A"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-rose-500/20 text-[#8ba0b2] hover:text-rose-400 border border-white/10 hover:border-rose-500/40 transition-all cursor-pointer shrink-0"
                title="Close (Esc)"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body / Description */}
            <div className="p-6 overflow-y-auto text-sm text-[#e2e8f0]/90 leading-relaxed space-y-4 max-h-[60vh] custom-scrollbar bg-[#0f1724]">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-[#0a111a] border border-[#1e2d42] text-xs">
                <div>
                  <span className="text-[#64748b] uppercase font-bold text-[10px] block">
                    Artist
                  </span>
                  <span className="font-bold text-white">
                    {data.artist || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748b] uppercase font-bold text-[10px] block">
                    Author
                  </span>
                  <span className="font-bold text-[#3db4f2]">
                    {data.author || "Unknown"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b] block mb-2">
                  Description
                </span>
                <p className="whitespace-pre-line text-xs sm:text-sm text-zinc-300 bg-[#0a111a]/50 p-4 rounded-xl border border-white/5">
                  {data.description ||
                    "No description provided for this series."}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-[#0a111a] border-t border-[#1e2d42] flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => window.open(link, "_blank")}
                className="px-5 py-2.5 rounded-xl bg-linear-to-r from-[#3db4f2] to-[#2563eb] text-white font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(61,180,242,0.4)] hover:brightness-110 transition-all active:scale-95 cursor-pointer"
              >
                Read Series on Cubari ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
