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

  // Pattern chuẩn của React: Tự điều chỉnh state theo URL thay đổi mà không cần useEffect
  if (queryQ !== prevQueryQ) {
    setPrevQueryQ(queryQ);
    setSearch(queryQ);
  }

  // Debounce 400ms và chỉ cập nhật URL khi dừng gõ
  useEffect(() => {
    if (search === queryQ) return;

    const timer = setTimeout(() => {
      const trimmed = search.trim();

      // Nếu chỉ gõ đúng 1 ký tự, không gửi request để tránh query vô ích
      if (trimmed.length === 1) return;

      const params = new URLSearchParams(searchParams.toString());

      if (trimmed.length >= 2) {
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
