import Image from "next/image";
import Link from "next/link";

interface HeaderProps {
  currentMode: string;
}

export default function Header({ currentMode }: HeaderProps) {
  return (
    <header className="mb-6 sm:mb-8 relative z-10">
      {/* ================= 1. DESKTOP / TABLET HEADER ================= */}
      <div className="hidden sm:flex items-center justify-between gap-6 pb-2">
        {/* Main Website Identity */}
        <Link
          href="/?mode=twitter"
          className="group flex items-center gap-4 select-none transition-all duration-300"
        >
          {/* Game-style Icon Container */}
          <div className="relative w-14 h-14 rounded-[1.25rem] overflow-hidden border-2 border-[#1e3452] bg-[#0b1622] shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all duration-300 group-hover:border-[#3db4f2] group-hover:shadow-[0_0_20px_rgba(61,180,242,0.3)] group-hover:-translate-y-1">
            <Image
              src="/logo.png"
              alt="A Certain Umazing Index Logo"
              fill
              sizes="56px"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              priority
            />
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-3">
              {/* Anime Gradient Title */}
              <h1 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-linear-to-r from-white via-[#e2e8f0] to-[#94a3b8] transition-all duration-300 group-hover:from-[#3db4f2] group-hover:via-[#60a5fa] group-hover:to-[#b784eb] pr-3">
                A CERTAIN UMAZING INDEX
              </h1>

              {/* Slanted Game Badge */}
              <div className="transform -skew-x-12 px-2.5 py-0.5 border bg-black/40 shadow-inner">
                <span className="block transform skew-x-12 text-[9px] font-black uppercase tracking-widest">
                  {currentMode === "cubari" ? (
                    <span className="text-[#eab308] drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]">
                      CUBARI
                    </span>
                  ) : (
                    <span className="text-[#3db4f2] drop-shadow-[0_0_5px_rgba(61,180,242,0.5)]">
                      X FEED
                    </span>
                  )}
                </span>
              </div>
            </div>

            <p className="text-xs font-medium text-[#7a93a8] tracking-wide mt-0.5 transition-colors duration-200 group-hover:text-[#a1b8cd]">
              An archive for translated Uma Musume comics on X
            </p>
          </div>
        </Link>

        {/* Right Action Bar: Mode Switcher + Saved Library */}
        <div className="flex items-center gap-4">
          {/* Pill-shaped Segmented Toggle (Game UI Style) */}
          <div className="flex items-center p-1.5 rounded-full bg-[#0a111a] border border-[#1e2d42] shadow-inner">
            <Link
              href="/?mode=twitter"
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black tracking-wide transition-all duration-300 ${
                currentMode === "twitter"
                  ? "bg-linear-to-r from-[#3db4f2] to-[#2563eb] text-white shadow-[0_0_15px_rgba(61,180,242,0.4)]"
                  : "text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/5"
              }`}
            >
              <div className="relative w-4 h-4 rounded-full overflow-hidden shrink-0 bg-white/20">
                <Image
                  src="/logo.png"
                  alt="Twitter Feed"
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <span>TWITTER</span>
            </Link>

            <Link
              href="/?mode=cubari"
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black tracking-wide transition-all duration-300 ${
                currentMode === "cubari"
                  ? "bg-linear-to-r from-[#f59e0b] to-[#ea580c] text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                  : "text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/5"
              }`}
            >
              <div className="relative w-4 h-4 rounded-full overflow-hidden shrink-0 bg-white/20">
                <Image
                  src="/fmc.ico"
                  alt="FMC Cubari"
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <span>CUBARI</span>
            </Link>
          </div>

          {/* Gacha-style Library Button */}
          <Link
            href="/library"
            className="group flex items-center gap-2 px-4 py-2 rounded-2xl bg-linear-to-b from-[#1e2d42] to-[#151f2e] border border-[#2d4361] hover:border-[#f43f5e] transition-all duration-300 shadow-md hover:shadow-[0_0_20px_rgba(244,63,94,0.3)] active:scale-95 shrink-0 select-none"
            title="Saved Library"
          >
            <div className="flex items-center justify-center text-[#f43f5e] group-hover:animate-pulse">
              <svg
                className="w-4 h-4 fill-current drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]"
                viewBox="0 0 24 24"
              >
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-white group-hover:text-rose-100">
              LIBRARY
            </span>
          </Link>
        </div>
      </div>

      {/* ================= 2. MOBILE HEADER ================= */}
      <div className="flex sm:hidden items-center justify-between gap-2 bg-[#0f1724]/90 backdrop-blur-md border border-[#1e2d42] p-2.5 rounded-2xl shadow-lg">
        <Link
          href={`/?mode=${currentMode}`}
          className="flex items-center gap-2 select-none shrink-0 min-w-0"
        >
          <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-[#1e3452] bg-[#0b1622] shrink-0">
            <Image
              src={currentMode === "cubari" ? "/fmc.ico" : "/logo.png"}
              alt="Brand Logo"
              fill
              sizes="40px"
              className="object-cover"
              priority
            />
          </div>
          <div className="flex flex-col truncate">
            <span className="text-sm font-black italic text-white truncate bg-clip-text bg-linear-to-r from-white to-[#cbd5e1]">
              UMAZING INDEX
            </span>
            <span className="text-[9px] font-bold tracking-widest uppercase text-[#3db4f2]">
              {currentMode === "cubari" ? "Cubari Mode" : "X Feed"}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Mode Switcher */}
          <div className="flex bg-[#0a111a] p-1 rounded-full border border-[#1e2d42] shadow-inner">
            <Link
              href="/?mode=twitter"
              className={`px-3 py-1.5 text-[10px] font-black rounded-full transition-all ${
                currentMode === "twitter"
                  ? "bg-linear-to-r from-[#3db4f2] to-[#2563eb] text-white shadow-[0_0_10px_rgba(61,180,242,0.4)]"
                  : "text-[#64748b]"
              }`}
            >
              X
            </Link>
            <Link
              href="/?mode=cubari"
              className={`px-3 py-1.5 text-[10px] font-black rounded-full transition-all ${
                currentMode === "cubari"
                  ? "bg-linear-to-r from-[#f59e0b] to-[#ea580c] text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                  : "text-[#64748b]"
              }`}
            >
              FMC
            </Link>
          </div>

          {/* Mobile Saved Library Button */}
          <Link
            href="/library"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-linear-to-br from-[#1e2d42] to-[#0f1724] border border-[#2d4361] text-rose-500 shrink-0 shadow-md active:scale-95"
          >
            <svg
              className="w-4 h-4 fill-current drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]"
              viewBox="0 0 24 24"
            >
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
