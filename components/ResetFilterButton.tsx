"use client";

import { useSearchParams } from "next/navigation";
import { usePageNavigation } from "./PageLoadingOverlay";

export default function ResetFilterButton() {
  const searchParams = useSearchParams();
  const { navigate, isPending } = usePageNavigation();

  const searchQuery = searchParams.get("q") || "";
  const selectedTag = searchParams.get("tag") || "all";
  const selectedArtist = searchParams.get("artist") || "all";
  const selectedTranslator = searchParams.get("translator") || "all";
  const selectedSort = searchParams.get("sort") || "newest";

  const isFiltered = Boolean(
    searchQuery ||
    (selectedTag && selectedTag !== "all") ||
    (selectedArtist && selectedArtist !== "all") ||
    (selectedTranslator && selectedTranslator !== "all") ||
    (selectedSort && selectedSort !== "newest"),
  );

  const handleReset = () => {
    navigate("/");
  };

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={handleReset}
        disabled={!isFiltered || isPending}
        title="Reset Filters"
        className={`h-10 px-3.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 select-none ${
          isFiltered && !isPending
            ? "bg-[#18283b] hover:bg-[#203650] text-[#3db4f2] border-[#273d5a] hover:border-[#3db4f2]/60 shadow-md shadow-[#3db4f2]/10 cursor-pointer"
            : "bg-[#0b1622] text-[#4b6075] border-[#27364b]/50 cursor-not-allowed opacity-40"
        }`}
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-300 ${
            isFiltered && !isPending ? "hover:-rotate-90" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>Reset</span>
      </button>
    </div>
  );
}
