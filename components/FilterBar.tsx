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
      className={`relative bg-[#0f1724]/60 backdrop-blur-md border border-[#1e2d42] rounded-[1.25rem] p-3 sm:p-5 mb-6 sm:mb-8 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(61,180,242,0.1)] hover:border-[#3db4f2]/30 transition-all duration-300 z-20 ${
        isPending
          ? "opacity-50 pointer-events-none scale-[0.99]"
          : "opacity-100 scale-100"
      }`}
    >
      {/* Decorative inner glow (subtle) */}
      <div className="absolute inset-0 rounded-[1.25rem] pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"></div>

      {/* Mobile Top Row: Search Input + Filter Toggle Button */}
      <div className="flex items-center gap-2 sm:hidden relative z-10">
        <div className="flex-1">
          <SearchBar />
        </div>

        {!isCubariMode && (
          <button
            type="button"
            onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
            className={`h-10 px-3.5 rounded-xl border font-black text-[11px] tracking-wide flex items-center gap-2 transition-all duration-300 shrink-0 cursor-pointer active:scale-95 ${
              activeFiltersCount > 0 || isMobileFilterOpen
                ? "bg-linear-to-r from-[#3db4f2] to-[#2563eb] text-white border-transparent shadow-[0_0_15px_rgba(61,180,242,0.4)]"
                : "bg-[#0a111a] text-[#8ba0b2] border-[#27364b] hover:text-white hover:border-[#3db4f2]/50"
            }`}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${isMobileFilterOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span>FILTERS</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-[#2563eb] text-[10px] flex items-center justify-center font-black shadow-inner">
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
        } grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_auto] gap-4 items-end pt-4 sm:pt-0 mt-4 sm:mt-0 border-t sm:border-t-0 border-[#1e2d42]/60 relative z-10`}
      >
        {/* Search Text (Desktop view) */}
        <div className="hidden sm:block">
          <SearchBar />
        </div>

        {/* 1. Character Filter */}
        {!isCubariMode && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-42 group">
            <label className="text-[10px] font-black tracking-widest text-[#64748b] uppercase group-focus-within:text-[#3db4f2] transition-colors drop-shadow-sm">
              Character
            </label>
            <CharacterSearchSelect tags={tags} selectedSlug={selectedTag} />
          </div>
        )}

        {/* 2. Original Artist Filter */}
        {!isCubariMode && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-42 group">
            <label className="text-[10px] font-black tracking-widest text-[#64748b] uppercase group-focus-within:text-[#3db4f2] transition-colors drop-shadow-sm">
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
          <div className="flex flex-col gap-1.5 flex-1 min-w-42 group">
            <label className="text-[10px] font-black tracking-widest text-[#64748b] uppercase group-focus-within:text-[#3db4f2] transition-colors drop-shadow-sm">
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
        {!isCubariMode && (
          <div className="group">
            <SortSelect />
          </div>
        )}

        {/* 5. Reset Filters Button */}
        <div className="flex justify-end pt-2 sm:pt-0">
          <ResetFilterButton />
        </div>
      </div>
    </div>
  );
}
