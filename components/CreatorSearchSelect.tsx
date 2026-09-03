// components/CreatorSearchSelect.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Creator {
  id: string;
  name: string;
  handle: string;
}

interface CreatorSearchSelectProps {
  paramKey: "artist" | "translator";
  label: string;
  creators: Creator[];
  selectedHandle: string;
}

function formatHandle(handle: string) {
  if (!handle) return "";
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export default function CreatorSearchSelect({
  paramKey,
  label,
  creators,
  selectedHandle,
}: CreatorSearchSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const activeCreator = creators.find((c) => c.handle === selectedHandle);

  const filteredCreators = creators.filter((c) => {
    const q = query.toLowerCase().trim().replace(/^@/, "");
    const cleanHandle = c.handle.toLowerCase().replace(/^@/, "");
    return c.name.toLowerCase().includes(q) || cleanHandle.includes(q);
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

  const handleSelect = (handle: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (handle && handle !== "all") {
      params.set(paramKey, handle);
    } else {
      params.delete(paramKey);
    }
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Nút bấm hiển thị */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 px-3 rounded-lg bg-[#0b1622] border border-[#27364b] hover:border-[#3db4f2]/70 text-left text-xs text-white flex items-center justify-between transition focus:outline-none focus:border-[#3db4f2]"
      >
        <span className="truncate pr-2">
          {activeCreator
            ? `${activeCreator.name} (${formatHandle(activeCreator.handle)})`
            : label}
        </span>
        <span className="text-[#8ba0b2] text-[10px] shrink-0">▼</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[#0b1622] border border-[#27364b] rounded-xl shadow-2xl overflow-hidden">
          {/* Ô tìm kiếm */}
          <div className="p-2 border-b border-[#1e2d42]">
            <input
              type="text"
              autoFocus
              placeholder={`Search ${paramKey} or @handle...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#151f2e] border border-[#27364b] text-xs text-white placeholder-[#5a6f82] focus:outline-none focus:border-[#3db4f2]"
            />
          </div>

          {/* Danh sách kết quả */}
          <div className="max-h-60 overflow-y-auto py-1 divide-y divide-[#1e2d42]/40 text-xs">
            <div
              onClick={() => handleSelect("all")}
              className={`px-3 py-2 cursor-pointer transition hover:bg-[#151f2e] hover:text-[#3db4f2] ${
                !selectedHandle || selectedHandle === "all"
                  ? "text-[#3db4f2] font-bold bg-[#151f2e]/60"
                  : "text-[#8ba0b2]"
              }`}
            >
              {label}
            </div>

            {filteredCreators.length === 0 ? (
              <div className="px-3 py-4 text-center text-[#5a6f82] text-xs">
                No {paramKey} found
              </div>
            ) : (
              filteredCreators.map((creator) => (
                <div
                  key={creator.id}
                  onClick={() => handleSelect(creator.handle)}
                  className={`px-3 py-2 cursor-pointer transition hover:bg-[#151f2e] flex flex-col ${
                    selectedHandle === creator.handle
                      ? "text-[#3db4f2] font-semibold bg-[#151f2e]/80"
                      : "text-zinc-200"
                  }`}
                >
                  <span className="truncate">{creator.name}</span>
                  <span className="text-[10px] text-[#5a6f82]">
                    {formatHandle(creator.handle)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
