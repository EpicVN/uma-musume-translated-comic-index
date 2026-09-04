import Image from "next/image";
import { PrismaClient, Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import TweetGridCard from "@/components/TweetGridCard";
import Link from "next/link";

// 1. Use a single PrismaClient instance for the entire app to prevent exhausting database connections
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const PAGE_SIZE = 12;

// 2. Cache filter options (tags, artists, translators) for 1 hour
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

interface FilterQuery {
  page: number;
  q: string;
  tag: string;
  artist: string;
  translator: string;
  sort: string;
}

// 3. Cache the list of posts based on filter query for 1 minute
const getCachedPosts = (filter: FilterQuery) => {
  // Chuẩn hóa chuỗi tìm kiếm
  const cleanQuery = filter.q?.trim() || "";

  // Dùng cleanQuery trong cacheKey để đồng nhất dữ liệu cache
  const cacheKey = `posts-${filter.page}-${cleanQuery}-${filter.tag}-${filter.artist}-${filter.translator}-${filter.sort}`;

  return unstable_cache(
    async () => {
      const where: Prisma.TranslatedPostWhereInput = {};
      const originalPostWhere: Prisma.OriginalPostWhereInput = {};

      // BƯỚC 2: Chỉ kích hoạt full scan khi từ khóa có từ 2 ký tự trở lên
      if (cleanQuery.length >= 2) {
        where.OR = [
          { content: { contains: cleanQuery, mode: "insensitive" } },
          {
            originalPost: {
              content: { contains: cleanQuery, mode: "insensitive" },
            },
          },
        ];
      }

      if (filter.translator && filter.translator !== "all") {
        where.translator = { handle: filter.translator };
      }

      if (filter.artist && filter.artist !== "all") {
        originalPostWhere.artist = { handle: filter.artist };
      }

      if (filter.tag && filter.tag !== "all") {
        originalPostWhere.tags = { some: { tag: { slug: filter.tag } } };
      }

      if (Object.keys(originalPostWhere).length > 0) {
        where.originalPost = originalPostWhere;
      }

      // Set the orderBy based on the sort option
      let orderBy: Prisma.TranslatedPostOrderByWithRelationInput = {
        postedAt: "desc",
      };
      if (filter.sort === "oldest") {
        orderBy = { postedAt: "asc" };
      } else if (filter.sort === "orig_newest") {
        orderBy = { originalPost: { postedAt: "desc" } };
      } else if (filter.sort === "orig_oldest") {
        orderBy = { originalPost: { postedAt: "asc" } };
      }

      const [totalCount, posts] = await Promise.all([
        prisma.translatedPost.count({ where }),
        prisma.translatedPost.findMany({
          where,
          skip: (filter.page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          orderBy,
          include: {
            translator: true,
            originalPost: {
              include: {
                artist: true,
                tags: { include: { tag: true } },
              },
            },
          },
        }),
      ]);

      return { totalCount, posts };
    },
    [cacheKey],
    { revalidate: 60, tags: ["comics-feed"] },
  )();
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    tag?: string;
    artist?: string;
    translator?: string;
    sort?: string;
  }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const searchQuery = params.q || "";
  const tagSlug = params.tag || "";
  const artistHandle = params.artist || "";
  const translatorHandle = params.translator || "";
  const sort = params.sort || "newest";

  // Fetch filter options and posts concurrently
  const [{ allTags, artists, translators }, { totalCount, posts }] =
    await Promise.all([
      getFilterOptions(),
      getCachedPosts({
        page: currentPage,
        q: searchQuery,
        tag: tagSlug,
        artist: artistHandle,
        translator: translatorHandle,
        sort,
      }),
    ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <main className="min-h-screen bg-[#0b1622] text-[#bcbedc] px-4 sm:px-8 md:px-12 py-8">
      {/* Header Bar */}
      <Link
        href="/"
        className="group inline-flex items-center gap-3.5 select-none transition-all duration-200"
      >
        {/* Logo Icon */}
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

        {/* Title & Subtitle */}
        <div className="flex flex-col">
          <h1 className="text-xl font-extrabold tracking-tight text-white transition-colors duration-200 group-hover:text-[#3db4f2]">
            UmaIndex
          </h1>
          <p className="text-xs text-[#8ba0b2] transition-colors duration-200 group-hover:text-slate-300">
            Uma Musume Translated Comic Archive
          </p>
        </div>
      </Link>

      {/* Filter Bar */}
      <FilterBar tags={allTags} artists={artists} translators={translators} />

      {/* Grid */}
      {posts.length === 0 ? (
        <div className="text-center py-20 bg-[#151f2e] rounded-xl border border-[#1e2d42]">
          <p className="text-lg text-[#8ba0b2]">No translated manga found.</p>
          <p className="text-sm text-[#5a6f82] mt-1">
            Try resetting or adjusting the filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 items-start">
          {posts.map((post, index) => (
            <TweetGridCard
              key={post.id}
              origId={post.originalPost.tweetId}
              transId={post.tweetId}
              artistName={post.originalPost.artist.name}
              translatorName={post.translator.handle}
              language={post.language}
              tags={post.originalPost.tags.map((pt) => pt.tag)}
              postedAt={post.postedAt}
              priority={index < 4}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination currentPage={currentPage} totalPages={totalPages} />
    </main>
  );
}
