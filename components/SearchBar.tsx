"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePageNavigation } from "./PageLoadingOverlay";

export default function SearchBar() {
  const searchParams = useSearchParams();
  const { navigate, isPending } = usePageNavigation();

  const queryQ = searchParams.get("q") || "";
  const [search, setSearch] = useState(queryQ);

  const executeSearch = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === queryQ) return;

    const params = new URLSearchParams(searchParams.toString());

    if (trimmed.length >= 2) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }
    params.set("page", "1");

    navigate(`/?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeSearch(search);
    }
  };

  const handleClear = () => {
    setSearch("");
    if (!queryQ) return;

    const params = new URLSearchParams(searchParams.toString());
    const mode = params.get("mode");
    params.delete("q");
    params.set("page", "1");
    params.set("mode", mode || "twitter");
    navigate(`/?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-40">
      <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
        Search
      </label>
      <div className="relative flex items-center">
        <input
          type="text"
          disabled={isPending}
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-10 px-3 pr-16 rounded-lg bg-[#0b1622] border border-[#27364b] hover:border-[#3db4f2]/60 focus:border-[#3db4f2] text-xs text-white placeholder-[#5a6f82] focus:outline-none transition disabled:opacity-50"
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {search && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleClear}
              className="p-1 text-xs text-[#5a6f82] hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Clear"
            >
              ✕
            </button>
          )}

          {/* Search icon */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => executeSearch(search)}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-[#1e2d42] hover:bg-[#3db4f2] text-[#8ba0b2] hover:text-white transition cursor-pointer disabled:opacity-50"
            title="Search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
