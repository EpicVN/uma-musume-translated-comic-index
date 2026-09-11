"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import SearchBar from "./SearchBar";
import CreatorSearchSelect from "./CreatorSearchSelect";
import CharacterSearchSelect from "./CharacterSearchSelect";
import SortSelect from "./SortSelect";
import ResetFilterButton from "./ResetFilterButton";
import { usePageNavigation } from "./PageLoadingOverlay";

interface Tag {
  id: string;
  name: string;
  slug: string;
  jpName?: string | null;
}

interface Creator {
  id: string;
  name: string;
  handle: string;
}

interface FilterBarProps {
  tags: Tag[];
  artists: Creator[];
  translators: Creator[];
}

export default function FilterBar({
  tags,
  artists,
  translators,
}: FilterBarProps) {
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const searchParams = useSearchParams();
  const { isPending } = usePageNavigation();

  const selectedTag = searchParams.get("tag") || "all";
  const selectedArtist = searchParams.get("artist") || "all";
  const selectedTranslator = searchParams.get("translator") || "all";
  const selectedSort = searchParams.get("sort") || "newest";
  const isCubariMode = searchParams.get("mode") === "cubari";

  // Count active filter criteria
  const activeFiltersCount = [
    selectedTag !== "all",
    selectedArtist !== "all",
    selectedTranslator !== "all",
    selectedSort !== "newest",
  ].filter(Boolean).length;

  return (
    <div
      className={`bg-[#151f2e] border border-[#1e2d42] rounded-2xl p-3 sm:p-5 mb-6 sm:mb-8 shadow-lg shadow-black/20 transition-opacity duration-200 ${
        isPending ? "opacity-60 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Mobile Top Row: Search Input + Filter Toggle Button */}
      <div className="flex items-center gap-2 sm:hidden">
        <div className="flex-1">
          <SearchBar />
        </div>

        {!isCubariMode && (
          <button
            type="button"
            onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
            className={`h-10 px-3 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
              activeFiltersCount > 0 || isMobileFilterOpen
                ? "bg-[#3db4f2] text-white border-[#3db4f2]"
                : "bg-[#0b1622] text-[#8ba0b2] border-[#27364b]"
            }`}
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
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-[#0b1622] text-[10px] flex items-center justify-center font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Filter Dropdowns Grid: Hidden on mobile unless toggled, always visible on Desktop */}
      <div
        className={`${
          isMobileFilterOpen ? "grid" : "hidden sm:grid"
        } grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_auto] gap-3 sm:gap-4 items-end pt-3 sm:pt-0 mt-3 sm:mt-0 border-t sm:border-t-0 border-[#1e2d42]/60`}
      >
        {/* Search Text (Desktop view) */}
        <div className="hidden sm:block">
          <SearchBar />
        </div>

        {/* 1. Character Filter */}
        {!isCubariMode && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-42.5">
            <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
              Character
            </label>
            <CharacterSearchSelect tags={tags} selectedSlug={selectedTag} />
          </div>
        )}

        {/* 2. Original Artist Filter */}
        {!isCubariMode && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-42.5">
            <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
              Original Artist
            </label>
            <CreatorSearchSelect
              paramKey="artist"
              label="Any Artist"
              creators={artists}
              selectedHandle={selectedArtist}
            />
          </div>
        )}

        {/* 3. Translator Filter */}
        {!isCubariMode && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-42.5">
            <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
              Translator
            </label>
            <CreatorSearchSelect
              paramKey="translator"
              label="Any Translator"
              creators={translators}
              selectedHandle={selectedTranslator}
            />
          </div>
        )}

        {/* 4. Sort Order */}
        {!isCubariMode && <SortSelect />}

        {/* 5. Reset Filters Button */}
        <div className="flex justify-end pt-1 sm:pt-0">
          <ResetFilterButton />
        </div>
      </div>
    </div>
  );
}
