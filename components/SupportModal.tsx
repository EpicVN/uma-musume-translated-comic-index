"use client";

import { useEffect } from "react";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Bạn có thể thay link mặc định ở đây hoặc truyền từ props vào
  kofiUrl?: string;
  paypalUrl?: string;
}

export default function SupportModal({
  isOpen,
  onClose,
  kofiUrl = "https://ko-fi.com/epicvn",
  paypalUrl = "https://paypal.me/EpicVN",
}: SupportModalProps) {
  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Lớp nền mờ backdrop */}
      <div
        className="fixed inset-0 bg-[#050b14]/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Khung nội dung Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-[#0b1622] border border-[#1e2d42] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Nút đóng X */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Header Modal */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-2xl mb-3 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            🥕
          </div>
          <h3 className="text-lg font-black text-white tracking-wide uppercase">
            Support the Project
          </h3>
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
            If you enjoy the translations and want to support server upkeep,
            consider buying a carrot!
          </p>
        </div>

        {/* Danh sách các cổng ủng hộ quốc tế */}
        <div className="flex flex-col gap-3">
          {/* Nút Ko-fi */}
          <a
            href={kofiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between p-3.5 rounded-xl bg-[#ff5e5b]/10 hover:bg-[#ff5e5b]/20 border border-[#ff5e5b]/30 hover:border-[#ff5e5b] transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#ff5e5b] flex items-center justify-center text-white font-black text-sm shadow-md">
                ☕
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white group-hover:text-[#ff7875] transition-colors">
                  Support on Ko-fi
                </div>
                <div className="text-[11px] text-zinc-400">
                  Fuel the server with carrots 🥕
                </div>
              </div>
            </div>
            <svg
              className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </a>

          {/* Nút PayPal */}
          <a
            href={paypalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between p-3.5 rounded-xl bg-[#0070ba]/10 hover:bg-[#0070ba]/20 border border-[#0070ba]/30 hover:border-[#0070ba] transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0070ba] flex items-center justify-center text-white font-black text-sm shadow-md">
                P
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white group-hover:text-[#38a3f8] transition-colors">
                  Donate via PayPal
                </div>
                <div className="text-[11px] text-zinc-400">
                  Direct transfer (Cards / Balance)
                </div>
              </div>
            </div>
            <svg
              className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </a>
        </div>

        {/* Lời cảm ơn nhỏ dưới chân */}
        <div className="mt-5 text-center">
          <span className="text-[11px] font-medium text-zinc-500">
            Thank you for being part of our community! ✨
          </span>
        </div>
      </div>
    </div>
  );
}
