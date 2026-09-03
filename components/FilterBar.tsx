// components/FilterBar.tsx
'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchBar from './SearchBar';
import CreatorSearchSelect from './CreatorSearchSelect';
import CharacterSearchSelect from './CharacterSearchSelect';

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

export default function FilterBar({ tags, artists, translators }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const selectedTag = searchParams.get('tag') || 'all';
  const selectedArtist = searchParams.get('artist') || 'all';
  const selectedTranslator = searchParams.get('translator') || 'all';
  const selectedSort = searchParams.get('sort') || 'newest';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    params.set('page', '1');

    startTransition(() => {
      router.push(`/?${params.toString()}`);
    });
  };

  return (
    <div className="bg-[#151f2e] border border-[#1e2d42] rounded-2xl p-4 sm:p-5 mb-8 shadow-lg shadow-black/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        {/* 1. Search text */}
        <SearchBar />

        {/* 2. Character Filter (Searchable Combobox) */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[170px]">
          <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
            Character
          </label>
          <CharacterSearchSelect tags={tags} selectedSlug={selectedTag} />
        </div>

        {/* 3. Original Artist Filter */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
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
        <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
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
        <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
          <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
            Sort
          </label>
          <select
            value={selectedSort}
            onChange={(e) => updateFilter('sort', e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-[#0b1622] border border-[#27364b] hover:border-[#3db4f2]/60 focus:border-[#3db4f2] text-xs text-white focus:outline-none transition cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>
    </div>
  );
}