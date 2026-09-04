// components/CharacterSearchSelect.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePageNavigation } from "./PageLoadingOverlay";

interface Tag {
  id: string;
  name: string;
  slug: string;
  jpName?: string | null;
}

interface CharacterSearchSelectProps {
  tags: Tag[];
  selectedSlug: string;
}

export default function CharacterSearchSelect({
  tags,
  selectedSlug,
}: CharacterSearchSelectProps) {
  const searchParams = useSearchParams();
  const { navigate, isPending } = usePageNavigation();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTag = tags.find((t) => t.slug === selectedSlug);

  const filteredTags = tags.filter((t) => {
    const q = query.toLowerCase().trim();
    const matchName = t.name.toLowerCase().includes(q);
    const matchJp = t.jpName ? t.jpName.toLowerCase().includes(q) : false;
    const matchSlug = t.slug.toLowerCase().includes(q);
    return matchName || matchJp || matchSlug;
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug && slug !== "all") {
      params.set("tag", slug);
    } else {
      params.delete("tag");
    }
    params.set("page", "1");
    navigate(`/?${params.toString()}`);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 px-3 rounded-lg bg-[#0b1622] border border-[#27364b] hover:border-[#3db4f2]/70 text-left text-xs text-white flex items-center justify-between transition focus:outline-none focus:border-[#3db4f2] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate pr-2">
          {activeTag ? activeTag.name : "Any Character"}
        </span>
        <span className="text-[#8ba0b2] text-[10px] shrink-0">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[#0b1622] border border-[#27364b] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-[#1e2d42]">
            <input
              type="text"
              autoFocus
              disabled={isPending}
              placeholder="Search character name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#151f2e] border border-[#27364b] text-xs text-white placeholder-[#5a6f82] focus:outline-none focus:border-[#3db4f2] disabled:opacity-50"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1 divide-y divide-[#1e2d42]/40 text-xs">
            <div
              onClick={() => !isPending && handleSelect("all")}
              className={`px-3 py-2 cursor-pointer transition hover:bg-[#151f2e] hover:text-[#3db4f2] ${
                !selectedSlug || selectedSlug === "all"
                  ? "text-[#3db4f2] font-bold bg-[#151f2e]/60"
                  : "text-[#8ba0b2]"
              }`}
            >
              Any Character
            </div>

            {filteredTags.length === 0 ? (
              <div className="px-3 py-4 text-center text-[#5a6f82] text-xs">
                No character found
              </div>
            ) : (
              filteredTags.map((tag) => (
                <div
                  key={tag.id}
                  onClick={() => !isPending && handleSelect(tag.slug)}
                  className={`px-3 py-2 cursor-pointer transition hover:bg-[#151f2e] flex items-center justify-between gap-2 ${
                    selectedSlug === tag.slug
                      ? "text-[#3db4f2] font-semibold bg-[#151f2e]/80"
                      : "text-zinc-200"
                  }`}
                >
                  <span className="truncate">{tag.name}</span>
                  {tag.jpName && (
                    <span className="text-[10px] text-[#5a6f82] shrink-0">
                      {tag.jpName}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
