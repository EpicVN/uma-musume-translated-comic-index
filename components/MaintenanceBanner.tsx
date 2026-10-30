"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CuteMaintenanceNotice() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // 1. Kiểm tra session xem đã tắt vĩnh viễn trong phiên chưa
    const isDismissed = sessionStorage.getItem("dismissed_cute_db_notice");
    if (isDismissed) return;

    // 2. Chuyển setState sang macro-task để tránh lỗi cascading render của React 19
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    // 3. Tự động thu nhỏ thành badge ở góc dưới sau 4.5 giây
    const minimizeTimer = setTimeout(() => {
      setIsMinimized(true);
    }, 4500);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(minimizeTimer);
    };
  }, []);

  const handleDismiss = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsVisible(false);
    sessionStorage.setItem("dismissed_cute_db_notice", "true");
  };

  const handleMinimize = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsMinimized(true);
  };

  const handleExpand = () => {
    setIsMinimized(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence mode="wait">
      {/* 🌟 1. POPUP TRUNG TÂM (Trạng thái mở to ban đầu) */}
      {!isMinimized ? (
        <div
          key="maintenance-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md pointer-events-auto"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 25 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0, y: 30 }}
            transition={{ type: "spring", damping: 22, stiffness: 320 }}
            className="relative w-full max-w-85 overflow-hidden rounded-[2.5rem] bg-[#0c1524]/95 border-2 border-amber-300/35 p-7 text-center shadow-[0_0_55px_rgba(251,191,36,0.2)] backdrop-blur-xl"
          >
            {/* Vầng sáng pastel ấm áp phía sau */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-44 h-44 bg-linear-to-b from-amber-400/25 to-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Mascot Cà rốt ngủ bồng bềnh */}
            <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-linear-to-tr from-amber-400/20 via-orange-400/15 to-transparent border border-amber-300/30 animate-pulse" />
              <span className="text-4xl select-none inline-block animate-[bounce_3s_ease-in-out_infinite]">
                🥕
              </span>
              <span className="absolute -top-1 right-2 text-xs font-black text-cyan-300/80 animate-ping">
                z
              </span>
              <span className="absolute -top-3 right-0 text-sm font-black text-cyan-200 animate-pulse">
                Z
              </span>
            </div>

            {/* Tiêu đề & Nội dung ngắn gọn */}
            <h3 className="text-lg font-black tracking-wide text-amber-200">
              Archives Taking a Nap! 💤
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-slate-300 font-medium px-2">
              Older comics are taking a tiny break for routine maintenance. Everything will fully wake up on{" "}
              <span className="inline-block px-2.5 py-0.5 mt-1 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-300/35">
                Nov 1st ✨
              </span>
            </p>

            {/* Cụm nút bấm Candy 3D */}
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleMinimize}
                className="w-full py-3 px-6 rounded-2xl bg-linear-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_4px_0_#b45309,0_8px_20px_rgba(245,158,11,0.3)] active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Got It!</span>
                <span className="text-sm">🥕</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 py-1 transition cursor-pointer"
              >
                Dismiss for now
              </button>
            </div>
          </motion.div>
        </div>
      ) : (
        /* 🌟 2. FLOATING BADGE (Trạng thái thu nhỏ góc dưới bên phải) */
        <motion.div
          key="maintenance-pill"
          initial={{ opacity: 0, scale: 0.6, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ type: "spring", damping: 20, stiffness: 280 }}
          onClick={handleExpand}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full bg-[#0c1524]/95 border border-amber-400/35 px-4 py-2.5 shadow-[0_8px_25px_rgba(0,0,0,0.6)] backdrop-blur-xl hover:border-amber-400/70 hover:scale-105 active:scale-95 transition-all group cursor-pointer"
        >
          <span className="text-base select-none group-hover:rotate-12 transition-transform">
            🥕
          </span>
          <span className="text-xs font-semibold text-amber-200 group-hover:text-amber-100 flex items-center gap-1.5">
            <span>Archive Restoring</span>
            <span className="text-white/30">•</span>
            <strong className="text-amber-400 font-bold">Nov 1</strong>
          </span>

          {/* Nút đóng hoàn toàn */}
          <button
            type="button"
            onClick={handleDismiss}
            className="ml-1 -mr-1.5 p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="Close permanently for this session"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}