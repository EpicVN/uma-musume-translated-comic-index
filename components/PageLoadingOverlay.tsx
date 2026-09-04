"use client";

import { createContext, useContext, useTransition, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface NavigationContextType {
  isPending: boolean;
  navigate: (url: string) => void;
}

const NavigationContext = createContext<NavigationContextType>({
  isPending: false,
  navigate: () => {},
});

export const usePageNavigation = () => useContext(NavigationContext);

export default function PageLoadingOverlay({
  children,
}: {
  children: ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const navigate = (url: string) => {
    startTransition(() => {
      router.push(url);
    });
  };

  return (
    <NavigationContext.Provider value={{ isPending, navigate }}>
      <div className="relative min-h-screen">
        {/* Lớp phủ chặn click và làm mờ toàn bộ nội dung khi đang load */}
        {isPending && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0b1622]/60 backdrop-blur-[2px] pointer-events-auto cursor-wait">
            <div className="w-10 h-10 border-3 border-[#1e2d42] border-t-[#3db4f2] rounded-full animate-spin"></div>
            <span className="mt-3 text-xs font-semibold text-[#8ba0b2] tracking-wide">
              Loading...
            </span>
          </div>
        )}

        {/* Nội dung trang: bị vô hiệu hóa click khi isPending = true */}
        <div className={isPending ? "pointer-events-none select-none" : ""}>
          {children}
        </div>
      </div>
    </NavigationContext.Provider>
  );
}
