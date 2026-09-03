// components/SearchBar.tsx
"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const queryQ = searchParams.get("q") || "";
  const [search, setSearch] = useState(queryQ);
  const [prevQueryQ, setPrevQueryQ] = useState(queryQ);

  // Đồng bộ giá trị khi URL thay đổi (xóa bộ lọc hoặc điều hướng lịch sử)
  if (queryQ !== prevQueryQ) {
    setPrevQueryQ(queryQ);
    setSearch(queryQ);
  }

  // Cập nhật URL sau khi ngừng gõ
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

      startTransition(() => {
        router.push(`/?${params.toString()}`);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [search, queryQ, searchParams, router]);

  const handleClear = () => {
    setSearch("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.set("page", "1");
    startTransition(() => {
      router.push(`/?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
      <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
        Search
      </label>
      <div className="relative">
        <input
          type="text"
          placeholder="Search comic / text..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 px-3 pr-8 rounded-lg bg-[#0b1622] border border-[#27364b] hover:border-[#3db4f2]/60 focus:border-[#3db4f2] text-xs text-white placeholder-[#5a6f82] focus:outline-none transition"
        />
        {search && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5a6f82] hover:text-white transition"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
