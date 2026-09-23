"use client";

import { useState } from "react";
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
  const [isErrorShake, setIsErrorShake] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const result = toggleBookmark(item);
    if (!active && result.reason === "limit_reached") {
      // Trigger hiệu ứng lắc/cảnh báo đầy khi user cố bấm lưu lúc full
      setIsErrorShake(true);
      setTimeout(() => setIsErrorShake(false), 500);

      // Có thể dispatch event global để hiện toast ngoài màn hình chính nếu muốn
      window.dispatchEvent(
        new CustomEvent("toast-message", {
          detail: "Bookmark limit reached (200 max)!",
        }),
      );
    }
  };

  return (
    <button
      type="button"
      suppressHydrationWarning
      onClick={handleClick}
      title={active ? "Remove Bookmark" : "Save Bookmark"}
      aria-label="Toggle Bookmark"
      className={`p-1.5 rounded-lg transition-all duration-150 backdrop-blur-md flex items-center justify-center cursor-pointer ${
        active
          ? "text-rose-400 bg-rose-500/20 hover:bg-rose-500/30"
          : isErrorShake
            ? "text-amber-300 bg-amber-500/40 animate-bounce ring-1 ring-amber-400"
            : "text-neutral-300 bg-black/50 hover:text-white hover:bg-black/70"
      } ${className}`}
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
