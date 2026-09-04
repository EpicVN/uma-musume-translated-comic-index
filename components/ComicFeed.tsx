import { unstable_cache } from "next/cache";
import { PrismaClient, Prisma } from "@prisma/client";
import TweetGridCard from "@/components/TweetGridCard";
import Pagination from "@/components/Pagination";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const PAGE_SIZE = 12;

interface FilterQuery {
  page: number;
  q: string;
  tag: string;
  artist: string;
  translator: string;
  sort: string;
}

const getCachedPosts = (filter: FilterQuery) => {
  const cleanQuery = filter.q?.trim() || "";
  const cacheKey = `posts-${filter.page}-${cleanQuery}-${filter.tag}-${filter.artist}-${filter.translator}-${filter.sort}`;

  return unstable_cache(
    async () => {
      const where: Prisma.TranslatedPostWhereInput = {};
      const originalPostWhere: Prisma.OriginalPostWhereInput = {};

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

      let orderBy: Prisma.TranslatedPostOrderByWithRelationInput = {
        postedAt: "desc",
      };
      if (filter.sort === "oldest") orderBy = { postedAt: "asc" };
      else if (filter.sort === "orig_newest")
        orderBy = { originalPost: { postedAt: "desc" } };
      else if (filter.sort === "orig_oldest")
        orderBy = { originalPost: { postedAt: "asc" } };

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

export default async function ComicFeed({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string;
    q?: string;
    tag?: string;
    artist?: string;
    translator?: string;
    sort?: string;
  }>;
}) {
  // Tránh crash khi Next.js prerender trang ở build time
  const params = (await searchParams) || {};
  const currentPage = Number(params.page) || 1;
  const searchQuery = params.q || "";
  const tagSlug = params.tag || "";
  const artistHandle = params.artist || "";
  const translatorHandle = params.translator || "";
  const sort = params.sort || "newest";

  const { totalCount, posts } = await getCachedPosts({
    page: currentPage,
    q: searchQuery,
    tag: tagSlug,
    artist: artistHandle,
    translator: translatorHandle,
    sort,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (posts.length === 0) {
    return (
      <div className="text-center py-20 bg-[#151f2e] rounded-xl border border-[#1e2d42]">
        <p className="text-lg text-[#8ba0b2]">No translated manga found.</p>
        <p className="text-sm text-[#5a6f82] mt-1">
          Try resetting or adjusting the filters.
        </p>
      </div>
    );
  }

  return (
    <>
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
      <Pagination currentPage={currentPage} totalPages={totalPages} />
    </>
  );
}
