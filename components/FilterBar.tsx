"use client";

import { useSearchParams } from "next/navigation";
import SearchBar from "./SearchBar";
import CreatorSearchSelect from "./CreatorSearchSelect";
import CharacterSearchSelect from "./CharacterSearchSelect";
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
  const searchParams = useSearchParams();
  const { navigate, isPending } = usePageNavigation();

  const searchQuery = searchParams.get("q") || "";
  const selectedTag = searchParams.get("tag") || "all";
  const selectedArtist = searchParams.get("artist") || "all";
  const selectedTranslator = searchParams.get("translator") || "all";
  const selectedSort = searchParams.get("sort") || "newest";

  // Determine if any filters are applied
  const isFiltered = Boolean(
    searchQuery ||
    (selectedTag && selectedTag !== "all") ||
    (selectedArtist && selectedArtist !== "all") ||
    (selectedTranslator && selectedTranslator !== "all") ||
    (selectedSort && selectedSort !== "newest"),
  );

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    params.set("page", "1");
    navigate(`/?${params.toString()}`);
  };

  const handleReset = () => {
    navigate("/");
  };

  return (
    <div
      className={`bg-[#151f2e] border border-[#1e2d42] rounded-2xl p-4 sm:p-5 mb-8 shadow-lg shadow-black/20 transition-opacity duration-200 ${
        isPending ? "opacity-60 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-4 items-end">
        {/* 1. Search text */}
        <SearchBar />

        {/* 2. Character Filter (Searchable Combobox) */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-42.5">
          <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
            Character
          </label>
          <CharacterSearchSelect tags={tags} selectedSlug={selectedTag} />
        </div>

        {/* 3. Original Artist Filter */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-45">
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

        {/* 4. Translator Filter */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-45">
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

        {/* 5. Sort Order */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-35">
          <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
            Sort
          </label>
          <select
            disabled={isPending}
            value={selectedSort}
            onChange={(e) => updateFilter("sort", e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-[#0b1622] border border-[#27364b] hover:border-[#3db4f2]/60 focus:border-[#3db4f2] text-xs text-white focus:outline-none transition cursor-pointer disabled:opacity-50"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* 6. Reset Filters Button */}
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
      </div>
    </div>
  );
}
