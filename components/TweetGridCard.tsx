"use client";

import Image from "next/image";
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
    ? new Date(postedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
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
    <div className="flex flex-col bg-[#151f2e] rounded-xl overflow-hidden border border-[#1e2d42] hover:border-[#3db4f2]/70 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-[#3db4f2]/10 p-3">
      {/* Header Tag & Date */}
      <div className="flex items-center justify-between gap-1 text-[10px] pb-2 border-b border-[#1e2d42]/60 shrink-0 h-7">
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          {tags.length > 0 ? (
            <>
              {tags.slice(0, 2).map((t) => (
                <span
                  key={t.id}
                  className="font-bold bg-[#0b1622] text-[#3db4f2] px-1.5 py-0.5 rounded border border-[#27364b] truncate max-w-22.5 shrink-0"
                  title={t.name}
                >
                  {t.name}
                </span>
              ))}
              {tags.length > 2 && (
                <span
                  className="font-bold bg-[#0b1622] text-[#8ba0b2] px-1 py-0.5 rounded border border-[#27364b] shrink-0 cursor-default"
                  title={tags
                    .slice(2)
                    .map((t) => t.name)
                    .join(", ")}
                >
                  +{tags.length - 2}
                </span>
              )}
            </>
          ) : (
            <span className="text-[#8ba0b2] bg-[#0b1622] px-1.5 py-0.5 rounded border border-[#27364b] shrink-0">
              Uma Musume
            </span>
          )}
        </div>
        {formattedDate && (
          <span className="text-[#5a6f82] font-semibold shrink-0 ml-1">
            {formattedDate}
          </span>
        )}
      </div>

      {/* Manga Preview Thumbnail */}
      <div
        className="relative w-full aspect-3/4 my-2 overflow-hidden rounded-lg bg-[#0b1622] cursor-pointer group flex items-center justify-center border border-[#1e2d42]/40 shrink-0"
        onClick={onOpenReader}
      >
        {displayThumbnail ? (
          <Image
            src={displayThumbnail}
            alt={`Comic Preview by ${artistName}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        ) : (
          <div className="text-zinc-500 text-xs px-3 text-center">
            No image preview available
          </div>
        )}

        {/* Page Badge */}
        {totalPages > 1 && (
          <span className="absolute top-2 right-2 bg-black/75 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/10 z-10">
            1/{totalPages} P
          </span>
        )}

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
            title={artistName}
          >
            {artistName}
          </span>
        </div>

        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#8ba0b2]">Translator:</span>
          <span
            className="text-[#3db4f2] font-semibold truncate max-w-30"
            title={formatHandle(translatorName)}
          >
            {formatHandle(translatorName)}
          </span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onOpenReader}
            className="flex-1 py-1.5 rounded bg-[#22334a] hover:bg-[#3db4f2] text-zinc-200 hover:text-white text-[11px] font-bold transition-all duration-150 border border-[#2d4260] hover:border-[#3db4f2] shadow-sm active:scale-95 cursor-pointer"
          >
            Read
          </button>
          <a
            href={`https://x.com/i/status/${transId}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center py-1.5 rounded bg-[#0b1622] hover:bg-[#1a2638] text-[#8ba0b2] hover:text-[#3db4f2] text-[11px] font-bold transition-all duration-150 border border-[#27364b] hover:border-[#3db4f2]/60 active:scale-95 cursor-pointer"
          >
            View on X ↗
          </a>
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
    </div>
  );
}
