"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePageNavigation } from "./PageLoadingOverlay";

export default function SearchBar() {
  const searchParams = useSearchParams();
  const { navigate, isPending } = usePageNavigation();

  const queryQ = searchParams.get("q") || "";
  const [search, setSearch] = useState(queryQ);
  const [prevQueryQ, setPrevQueryQ] = useState(queryQ);

  // If the query parameter changes (e.g., via browser navigation), update the search state to reflect it.
  if (queryQ !== prevQueryQ) {
    setPrevQueryQ(queryQ);
    setSearch(queryQ);
  }

  // Update the URL after the user stops typing
  useEffect(() => {
    if (search === queryQ) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = search.trim();

      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      params.set("page", "1");

      navigate(`/?${params.toString()}`);
    }, 400);

    return () => clearTimeout(timer);
  }, [search, queryQ, searchParams, navigate]);

  const handleClear = () => {
    setSearch("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.set("page", "1");
    navigate(`/?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-40">
      <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
        Search
      </label>
      <div className="relative">
        <input
          type="text"
          disabled={isPending}
          placeholder="Search comic / text..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 px-3 pr-8 rounded-lg bg-[#0b1622] border border-[#27364b] hover:border-[#3db4f2]/60 focus:border-[#3db4f2] text-xs text-white placeholder-[#5a6f82] focus:outline-none transition disabled:opacity-50"
        />
        {search && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5a6f82] hover:text-white transition cursor-pointer disabled:opacity-50"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
