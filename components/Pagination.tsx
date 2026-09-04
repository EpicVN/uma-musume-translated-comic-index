// components/Pagination.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export default function Pagination({ currentPage, totalPages }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jumpPage, setJumpPage] = useState('');

  if (totalPages <= 1) return null;

  const navigateToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', validPage.toString());
    router.push(`/?${params.toString()}`);
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPage, 10);
    if (!isNaN(pageNum)) {
      navigateToPage(pageNum);
      setJumpPage('');
    }
  };

  // Tính toán dải số hiển thị (hiển thị tối đa 5 nút xung quanh trang hiện tại)
  const windowSize = 2;
  let startPage = Math.max(1, currentPage - windowSize);
  let endPage = Math.min(totalPages, currentPage + windowSize);

  if (currentPage - startPage < windowSize) {
    endPage = Math.min(totalPages, endPage + (windowSize - (currentPage - startPage)));
  }
  if (endPage - currentPage < windowSize) {
    startPage = Math.max(1, startPage - (windowSize - (endPage - currentPage)));
  }

  const pageNumbers: number[] = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-10 mb-6 text-xs select-none">
      {/* Cụm nút chuyển trang dạng dải số */}
      <div className="flex items-center gap-1.5 bg-[#151f2e] border border-[#1e2d42] p-1.5 rounded-xl shadow-md">
        {/* Previous */}
        <button
          onClick={() => navigateToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 rounded-lg bg-[#0b1622] text-[#8ba0b2] hover:text-white hover:bg-[#1e2d42] disabled:opacity-40 disabled:hover:bg-[#0b1622] disabled:hover:text-[#8ba0b2] font-semibold transition border border-transparent hover:border-[#27364b] cursor-pointer disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {/* Nút trang 1 nếu dải số đang ở xa */}
        {startPage > 1 && (
          <>
            <button
              onClick={() => navigateToPage(1)}
              className="min-w-8 h-8 px-2 rounded-lg bg-[#0b1622] text-[#8ba0b2] hover:text-white hover:bg-[#1e2d42] font-semibold transition border border-transparent hover:border-[#27364b] cursor-pointer"
            >
              1
            </button>
            {startPage > 2 && <span className="text-[#5a6f82] px-1">...</span>}
          </>
        )}

        {/* Các trang lân cận */}
        {pageNumbers.map((p) => {
          const isActive = p === currentPage;
          return (
            <button
              key={p}
              onClick={() => navigateToPage(p)}
              className={`min-w-8 h-8 px-2 rounded-lg font-bold transition cursor-pointer ${
                isActive
                  ? 'bg-[#3db4f2] text-white shadow-md shadow-[#3db4f2]/30 scale-105'
                  : 'bg-[#0b1622] text-[#8ba0b2] hover:text-white hover:bg-[#1e2d42] border border-transparent hover:border-[#27364b]'
              }`}
            >
              {p}
            </button>
          );
        })}

        {/* Nút trang cuối nếu dải số chưa tới */}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-[#5a6f82] px-1">...</span>}
            <button
              onClick={() => navigateToPage(totalPages)}
              className="min-w-8 h-8 px-2 rounded-lg bg-[#0b1622] text-[#8ba0b2] hover:text-white hover:bg-[#1e2d42] font-semibold transition border border-transparent hover:border-[#27364b] cursor-pointer"
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next */}
        <button
          onClick={() => navigateToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 rounded-lg bg-[#0b1622] text-[#8ba0b2] hover:text-white hover:bg-[#1e2d42] disabled:opacity-40 disabled:hover:bg-[#0b1622] disabled:hover:text-[#8ba0b2] font-semibold transition border border-transparent hover:border-[#27364b] cursor-pointer disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>

      {/* Ô nhập số trang nhảy nhanh (Go to Page) */}
      <form
        onSubmit={handleJumpSubmit}
        className="flex items-center gap-1.5 bg-[#151f2e] border border-[#1e2d42] px-2.5 py-1.5 rounded-xl shadow-md h-11"
      >
        <span className="text-[#8ba0b2] font-medium text-[11px]">Go to:</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          placeholder={currentPage.toString()}
          value={jumpPage}
          onChange={(e) => setJumpPage(e.target.value)}
          className="w-12 h-7 bg-[#0b1622] border border-[#27364b] focus:border-[#3db4f2] text-center text-white rounded-md text-xs font-semibold focus:outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-[#5a6f82] text-[11px]">/ {totalPages}</span>
        <button
          type="submit"
          className="h-7 px-2.5 rounded-md bg-[#22334a] hover:bg-[#3db4f2] text-zinc-300 hover:text-white text-[11px] font-bold border border-[#2d4260] hover:border-[#3db4f2] transition cursor-pointer"
        >
          Go
        </button>
      </form>
    </div>
  );
}