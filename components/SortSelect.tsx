"use client";

import { useSearchParams } from "next/navigation";
import { usePageNavigation } from "./PageLoadingOverlay";

export default function SortSelect() {
  const searchParams = useSearchParams();
  const { navigate, isPending } = usePageNavigation();
  const selectedSort = searchParams.get("sort") || "newest";

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value && value !== "newest") {
      params.set("sort", value);
    } else {
      params.delete("sort");
    }

    params.set("page", "1");
    navigate(`/?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-45">
      <label className="text-[10px] font-bold tracking-wider text-[#8ba0b2] uppercase">
        Sort
      </label>
      <select
        disabled={isPending}
        value={selectedSort}
        onChange={(e) => handleSortChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg bg-[#0b1622] border border-[#27364b] hover:border-[#3db4f2]/60 focus:border-[#3db4f2] text-xs text-white focus:outline-none transition cursor-pointer disabled:opacity-50"
      >
        <optgroup
          label="Translation Date"
          className="bg-[#151f2e] text-[#8ba0b2] font-semibold"
        >
          <option value="newest" className="text-white font-normal">
            TL: Newest First
          </option>
          <option value="oldest" className="text-white font-normal">
            TL: Oldest First
          </option>
        </optgroup>

        <optgroup
          label="Original Comic Date"
          className="bg-[#151f2e] text-[#8ba0b2] font-semibold"
        >
          <option value="orig_newest" className="text-white font-normal">
            Artist: Newest First
          </option>
          <option value="orig_oldest" className="text-white font-normal">
            Artist: Oldest First
          </option>
        </optgroup>
      </select>
    </div>
  );
}
