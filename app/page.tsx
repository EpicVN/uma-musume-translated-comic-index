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
      <div className="flex flex-col sm:flex-row items-center gap-8 mb-8">
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
              Full Moon Cafe's Cubari
            </h1>
            <p className="text-xs text-[#8ba0b2] transition-colors duration-200 group-hover:text-slate-300">
              Full Moon Cafe's Cubari Catalogue
            </p>
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
