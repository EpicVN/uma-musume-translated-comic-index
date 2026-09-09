import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { PrismaClient } from "@prisma/client";
import { unstable_cache } from "next/cache";
import FilterBar from "@/components/FilterBar";
import ComicFeed from "@/components/ComicFeed";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const dynamic = "force-dynamic";

const getFilterOptions = unstable_cache(
  async () => {
    const [allTags, artists, translators] = await Promise.all([
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
      prisma.creator.findMany({
        where: { originalPosts: { some: {} } },
        orderBy: { name: "asc" },
      }),
      prisma.creator.findMany({
        where: { translatedPosts: { some: {} } },
        orderBy: { name: "asc" },
      }),
    ]);
    return { allTags, artists, translators };
  },
  ["filter-options-data"],
  { revalidate: 3600, tags: ["filter-options"] },
);

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage(props: PageProps) {
  const { allTags, artists, translators } = await getFilterOptions();
  const searchParams = await props.searchParams;

  return (
    <main className="min-h-screen bg-[#0b1622] text-[#bcbedc] px-4 sm:px-8 md:px-12 py-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-8 mb-8">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          {/* Main UmaIndex Brand Link */}
          <Link
            href="/?mode=twitter"
            className="group inline-flex items-center gap-3.5 select-none transition-all duration-200"
          >
            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-[#27364b] bg-[#0b1622] shrink-0 shadow-sm transition-all duration-300 group-hover:border-[#3db4f2]/60 group-hover:shadow-lg group-hover:shadow-[#3db4f2]/20 group-hover:scale-105">
              <Image
                src="/logo.png"
                alt="UmaIndex Logo"
                fill
                sizes="40px"
                className="object-cover"
                priority
              />
            </div>

            <div className="flex flex-col">
              <h1 className="text-xl font-extrabold tracking-tight text-white transition-colors duration-200 group-hover:text-[#3db4f2]">
                UmaIndex
              </h1>
              <p className="text-xs text-[#8ba0b2] transition-colors duration-200 group-hover:text-slate-300">
                Uma Musume Translated Comic Archive
              </p>
            </div>
          </Link>

          {/* Cubari Catalogue Link */}
          <Link
            href="/?mode=cubari"
            className="group inline-flex items-center gap-3.5 select-none transition-all duration-200"
          >
            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-[#27364b] bg-[#0b1622] shrink-0 shadow-sm transition-all duration-300 group-hover:border-[#3db4f2]/60 group-hover:shadow-lg group-hover:shadow-[#3db4f2]/20 group-hover:scale-105">
              <Image
                src="/fmc.ico"
                alt="Cubari Logo"
                fill
                sizes="40px"
                className="object-cover"
                priority
              />
            </div>

            <div className="flex flex-col">
              <h1 className="text-xl font-extrabold tracking-tight text-white transition-colors duration-200 group-hover:text-[#3db4f2]">
                Full Moon Cafe&apos;s Cubari
              </h1>
              <p className="text-xs text-[#8ba0b2] transition-colors duration-200 group-hover:text-slate-300">
                Full Moon Cafe&apos;s Cubari Catalogue
              </p>
            </div>
          </Link>
        </div>

        {/* User Bookmarks / Library Link */}
        <Link
          href="/library"
          className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#151f2e] border border-[#27364b] hover:border-[#f43f5e]/60 transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-[#f43f5e]/10 active:scale-95 shrink-0 select-none sm:ml-auto"
        >
          <div className="w-7 h-7 rounded-lg bg-[#0b1622] border border-[#27364b] flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white group-hover:text-rose-400 transition-colors">
              Saved Library
            </span>
            <span className="text-[10px] text-[#8ba0b2]">
              Bookmarks & History
            </span>
          </div>
        </Link>
      </div>

      {/* Filter Bar */}
      <FilterBar tags={allTags} artists={artists} translators={translators} />

      {/* Comic Feed */}
      <Suspense
        fallback={
          <div className="flex justify-center items-center py-24">
            <div className="w-8 h-8 border-2 border-[#3db4f2] border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <ComicFeed
          page={
            typeof searchParams?.page === "string"
              ? searchParams.page
              : undefined
          }
          q={typeof searchParams?.q === "string" ? searchParams.q : undefined}
          tag={
            typeof searchParams?.tag === "string" ? searchParams.tag : undefined
          }
          artist={
            typeof searchParams?.artist === "string"
              ? searchParams.artist
              : undefined
          }
          translator={
            typeof searchParams?.translator === "string"
              ? searchParams.translator
              : undefined
          }
          sort={
            typeof searchParams?.sort === "string"
              ? searchParams.sort
              : undefined
          }
          mode={
            typeof searchParams?.mode === "string"
              ? searchParams.mode
              : "twitter"
          }
        />
      </Suspense>
    </main>
  );
}
