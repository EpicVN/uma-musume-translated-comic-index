"use client";

import { useReadingTracker } from "@/hooks/useReadingTracker";
import { ToggleBookmarkInput } from "@/types/storage";

interface BookmarkButtonProps {
  item: ToggleBookmarkInput;
  className?: string;
}

export default function BookmarkButton({
  item,
  className = "",
}: BookmarkButtonProps) {
  const { isBookmarked, toggleBookmark } = useReadingTracker();
  const active = isBookmarked(item.tweetId);

  return (
    <button
      type="button"
      suppressHydrationWarning
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmark(item);
      }}
      className={`p-1.5 rounded-lg transition-all duration-150 backdrop-blur-md flex items-center justify-center cursor-pointer ${
        active
          ? "text-rose-400 bg-rose-500/20 hover:bg-rose-500/30"
          : "text-neutral-400 bg-black/40 hover:text-white hover:bg-black/60"
      } ${className}`}
      title={active ? "Remove Bookmark" : "Save Bookmark"}
      aria-label="Toggle Bookmark"
    >
      <svg
        className="w-4 h-4 fill-current"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
    </button>
  );
}
