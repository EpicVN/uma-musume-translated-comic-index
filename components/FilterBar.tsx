"use client";

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
  const searchParams = useSearchParams();
  const { isPending } = usePageNavigation();

  const selectedTag = searchParams.get("tag") || "all";
  const selectedArtist = searchParams.get("artist") || "all";
  const selectedTranslator = searchParams.get("translator") || "all";

  const isCubariMode = searchParams.get("mode") === "cubari";

  return (
    <div
      className={`bg-[#151f2e] border border-[#1e2d42] rounded-2xl p-4 sm:p-5 mb-8 shadow-lg shadow-black/20 transition-opacity duration-200 ${
        isPending ? "opacity-60 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_auto] gap-4 items-end">
        {/* 1. Search Text */}
        <SearchBar />

        {/* 2. Character Filter */}
        {!isCubariMode && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-42.5">
            <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
              Character
            </label>
            <CharacterSearchSelect tags={tags} selectedSlug={selectedTag} />
          </div>
        )}

        {/* 3. Original Artist Filter */}
        {!isCubariMode && (
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
        )}

        {/* 4. Translator Filter */}
        {!isCubariMode && (
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
        )}

        {/* 5. Sort Order */}
        {!isCubariMode && <SortSelect />}

        {/* 6. Reset Filters Button */}
        <ResetFilterButton />
      </div>
    </div>
  );
}
