"use client";

import { useEffect, useState } from "react";

export default function GlobalToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setMessage(customEvent.detail);
      setTimeout(() => {
        setMessage(null);
      }, 3500);
    };

    window.addEventListener("toast-message", handleToast);
    return () => {
      window.removeEventListener("toast-message", handleToast);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-9999 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#0f1724]/95 border border-amber-500/50 text-amber-200 shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-300">
      <span className="text-base">⚠️</span>
      <span className="text-xs font-black tracking-wider uppercase">
        {message}
      </span>
    </div>
  );
}
