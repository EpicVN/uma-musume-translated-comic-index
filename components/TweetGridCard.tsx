"use client";

import Image from "next/image";
import { format } from "date-fns";
import BookmarkButton from "@/components/BookmarkButton";

interface TagItem {
  id: string;
  name: string;
  jpName?: string | null;
  slug?: string;
}

export interface TweetGridCardProps {
  origId: string;
  transId: string;
  artistName: string;
  translatorName: string;
  language?: string | null;
  tags?: TagItem[];
  postedAt?: Date | string;
  priority?: boolean;
  origMediaUrls?: string[];
  transMediaUrls?: string[];
  onOpenReader?: () => void;
}

function formatHandle(handle: string) {
  if (!handle) return "";
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export default function TweetGridCard({
  transId,
  artistName,
  translatorName,
  tags = [],
  postedAt,
  priority = false,
  origMediaUrls = [],
  transMediaUrls = [],
  onOpenReader,
}: TweetGridCardProps) {
  const formattedDate = postedAt
    ? format(new Date(postedAt), "MMM d, yyyy")
    : null;

  const displayThumbnail =
    transMediaUrls.length > 0
      ? transMediaUrls[0]
      : origMediaUrls.length > 0
        ? origMediaUrls[0]
        : null;

  const totalPages =
    transMediaUrls.length > 0 ? transMediaUrls.length : origMediaUrls.length;

  return (
    <div className="group relative w-full aspect-3/4 bg-[#050b14] rounded-2xl overflow-hidden border border-[#1e2d42] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(61,180,242,0.25)] hover:border-[#3db4f2]/50 outline-none focus-visible:ring-2 focus-visible:ring-[#3db4f2]">
      {/* Nạp ngầm trước ảnh gốc đầu tiên vào cache trình duyệt để mở modal load ngay */}
      {origMediaUrls.length > 0 && (
        <link rel="prefetch" href={origMediaUrls[0]} as="image" />
      )}

      {/* ================= KHU VỰC ẢNH CHÍNH ================= */}
      <div
        className="absolute inset-0 w-full h-full cursor-pointer z-0"
        onClick={onOpenReader}
      >
        {displayThumbnail ? (
          <Image
            src={displayThumbnail}
            alt={`Comic by ${artistName}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            unoptimized
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-zinc-500 text-xs bg-[#0b1622]">
            No preview available
          </div>
        )}

        {/* Overlay Hover "READ" (Thiết kế Glassmorphism) */}
        <div className="absolute inset-0 flex items-center justify-center bg-[#050b14]/30 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-all duration-300 pointer-events-none z-20">
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(61,180,242,0.3)] transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <svg
              className="w-4 h-4 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
            <span className="text-[11px] font-black tracking-widest text-white">
              READ
            </span>
          </div>
        </div>

        {/* Gradient Đáy - Tạo độ tối để chữ Footer hiển thị rõ */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-[#050b14] via-[#050b14]/80 to-transparent pointer-events-none z-10"></div>
      </div>

      {/* ================= HEADER OVERLAY (Nổi trên đỉnh) ================= */}
      <div className="absolute top-0 inset-x-0 p-3 flex items-start justify-between z-20 bg-linear-to-b from-[#0a111a]/90 via-[#0a111a]/50 to-transparent pb-12 pointer-events-none">
        <div className="flex flex-wrap gap-1.5 flex-1 pr-8">
          {tags.length > 0 ? (
            <>
              {tags.slice(0, 2).map((t) => (
                <span
                  key={t.id}
                  className="px-2 py-0.5 rounded-md bg-[#3db4f2]/20 border border-[#3db4f2]/40 text-[#3db4f2] text-[9px] font-black tracking-widest uppercase shadow-sm backdrop-blur-md transform -skew-x-6"
                >
                  <span
                    className="block transform skew-x-6 truncate max-w-20"
                    title={t.name}
                  >
                    {t.name}
                  </span>
                </span>
              ))}
              {tags.length > 2 && (
                <span className="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/20 text-white/90 text-[9px] font-black tracking-widest shadow-sm backdrop-blur-md">
                  +{tags.length - 2}
                </span>
              )}
            </>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-[#64748b]/20 border border-[#64748b]/40 text-[#cbd5e1] text-[9px] font-black tracking-widest uppercase shadow-sm backdrop-blur-md transform -skew-x-6">
              <span className="block transform skew-x-6">Uma Musume</span>
            </span>
          )}
        </div>
      </div>

      {/* ================= ACTION BUTTONS (Bookmark) ================= */}
      <div className="absolute top-2 right-2 z-30">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-0.5 border border-white/10 shadow-lg pointer-events-auto transition-transform hover:scale-105 active:scale-95">
          <BookmarkButton
            item={{
              tweetId: transId,
              title: `${artistName} (TL by ${formatHandle(translatorName)})`,
              coverImage: displayThumbnail || undefined,
              artistName,
              translatorHandle: translatorName,
            }}
          />
        </div>
      </div>

      {/* ================= FOOTER OVERLAY (Nổi dưới đáy) ================= */}
      <div className="absolute bottom-0 inset-x-0 px-3 pt-3 pb-4 flex flex-col gap-3 z-30 pointer-events-none mt-auto">
        {/* Credits */}
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-1.5 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 drop-shadow-md">
              <span className="text-[9px] font-black tracking-widest bg-linear-to-r from-[#f43f5e] to-[#be123c] text-white px-1.5 py-0.5 rounded shadow-sm shrink-0">
                ART
              </span>
              <span
                className="text-[13px] font-bold text-white truncate group-hover:text-[#f43f5e] transition-colors"
                title={artistName}
              >
                {artistName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 drop-shadow-md">
              <span className="text-[9px] font-black tracking-widest bg-linear-to-r from-[#eab308] to-[#ca8a04] text-white px-1.5 py-0.5 rounded shadow-sm shrink-0">
                TL
              </span>
              <span
                className="text-[13px] font-bold text-[#e2e8f0] truncate group-hover:text-[#eab308] transition-colors"
                title={formatHandle(translatorName)}
              >
                {formatHandle(translatorName)}
              </span>
            </div>
          </div>
        </div>

        {/* Dòng Action & Date */}
        <div className="flex items-center justify-between pt-2.5 border-t border-white/15 pointer-events-auto">
          {/* Nút View Post (Link nhỏ, gọn gàng hơn nút đen đặc) */}
          <a
            href={`https://x.com/i/status/${transId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[#8ba0b2] hover:text-[#3db4f2] text-[9px] font-black tracking-widest uppercase transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            X Post
          </a>

          {/* Ngày tháng */}
          <div className="flex items-center gap-2">
            {totalPages > 1 && (
              <span className="text-[10px] font-black text-[#3db4f2]">
                {totalPages}P
              </span>
            )}
            {formattedDate && (
              <span className="text-[9px] font-bold text-[#64748b]">
                {formattedDate}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
