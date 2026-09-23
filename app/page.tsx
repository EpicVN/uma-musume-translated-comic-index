import { Suspense } from "react";
import { PrismaClient } from "@prisma/client";
import { unstable_cache } from "next/cache";
import Header from "@/components/Header";
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
  const currentMode =
    typeof searchParams?.mode === "string" ? searchParams.mode : "twitter";

  return (
    <main className="min-h-screen bg-[#0b1622] bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-[#162945] via-[#0b1622] to-[#0b1622] text-[#bcbedc] px-3 sm:px-8 md:px-12 py-4 sm:py-6 relative overflow-hidden">
      {/* Decorative Anime Background Accents */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-[#3db4f2] opacity-[0.03] blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-[#f43f5e] opacity-[0.02] blur-[120px] rounded-full pointer-events-none"></div>

      {/* Extracted Header Component */}
      <Header currentMode={currentMode} />

      {/* Filter Bar */}
      <div className="relative z-40">
        <FilterBar tags={allTags} artists={artists} translators={translators} />
      </div>

      {/* Comic Feed */}
      <div>
        <Suspense
          fallback={
            <div className="flex justify-center items-center py-24">
              <div className="w-10 h-10 border-4 border-[#3db4f2] border-t-transparent rounded-full animate-spin drop-shadow-[0_0_10px_rgba(61,180,242,0.5)]" />
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
              typeof searchParams?.tag === "string"
                ? searchParams.tag
                : undefined
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
      </div>
    </main>
  );
}
