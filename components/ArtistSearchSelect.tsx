"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Creator {
  id: string;
  name: string;
  handle: string;
}

interface ArtistSearchSelectProps {
  artists: Creator[];
  selectedHandle: string;
}

// Chuẩn hóa handle chỉ hiển thị duy nhất 1 dấu @
function formatHandle(handle: string) {
  if (!handle) return "";
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export default function ArtistSearchSelect({
  artists,
  selectedHandle,
}: ArtistSearchSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const activeArtist = artists.find((a) => a.handle === selectedHandle);

  const filteredArtists = artists.filter((a) => {
    const q = query.toLowerCase().trim().replace(/^@/, "");
    const cleanHandle = a.handle.toLowerCase().replace(/^@/, "");
    return a.name.toLowerCase().includes(q) || cleanHandle.includes(q);
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
      params.set("artist", handle);
    } else {
      params.delete("artist");
    }
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Nút bấm hiển thị trạng thái hiện tại */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 px-3 rounded-lg bg-[#0b1622] border border-[#27364b] hover:border-[#3db4f2]/70 text-left text-xs text-white flex items-center justify-between transition focus:outline-none focus:border-[#3db4f2]"
      >
        <span className="truncate pr-2">
          {activeArtist
            ? `${activeArtist.name} (${formatHandle(activeArtist.handle)})`
            : "Any Artist"}
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
              placeholder="Search artist name or @handle..."
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
              Any Artist
            </div>

            {filteredArtists.length === 0 ? (
              <div className="px-3 py-4 text-center text-[#5a6f82] text-xs">
                No artist found
              </div>
            ) : (
              filteredArtists.map((artist) => (
                <div
                  key={artist.id}
                  onClick={() => handleSelect(artist.handle)}
                  className={`px-3 py-2 cursor-pointer transition hover:bg-[#151f2e] flex flex-col ${
                    selectedHandle === artist.handle
                      ? "text-[#3db4f2] font-semibold bg-[#151f2e]/80"
                      : "text-zinc-200"
                  }`}
                >
                  <span className="truncate">{artist.name}</span>
                  <span className="text-[10px] text-[#5a6f82]">
                    {formatHandle(artist.handle)}
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
