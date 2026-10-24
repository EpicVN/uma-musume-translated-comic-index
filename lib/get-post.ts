import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export interface PostFilterParams {
  q?: string;
  tag?: string;
  artist?: string;
  translator?: string;
  sort?: string;
  tl?: string; // 🌟 Bổ sung tham số tl để nhận diện bản dịch yêu cầu
}

export async function getPostById(id: string, filters?: PostFilterParams) {
  let post = null;

  // 1. Ưu tiên tìm chính xác bản dịch được yêu cầu qua ?tl= (khớp cả CUID lẫn Tweet ID)
  if (filters?.tl) {
    post = await prisma.translatedPost.findFirst({
      where: {
        OR: [{ id: filters.tl }, { tweetId: filters.tl }],
      },
      include: {
        translator: true,
        originalPost: {
          include: {
            artist: true,
            tags: { include: { tag: true } },
          },
        },
      },
    });
  }

  // Nếu không có ?tl hoặc không tìm thấy bản dịch theo tl -> Fallback tìm theo ID bài gốc
  if (!post) {
    post = await prisma.translatedPost.findFirst({
      where: {
        OR: [
          { id },
          { tweetId: id },
          { originalPostId: id },
          { originalPost: { id } },
          { originalPost: { tweetId: id } },
        ],
      },
      orderBy: { postedAt: "desc" }, // Ưu tiên bản dịch mới nhất nếu có nhiều bản
      include: {
        translator: true,
        originalPost: {
          include: {
            artist: true,
            tags: { include: { tag: true } },
          },
        },
      },
    });
  }

  if (!post) return null;

  // 2. Dựng điều kiện lọc (Filter Where) giống hệt ComicFeed
  const filterWhere: Prisma.TranslatedPostWhereInput = {};
  const originalPostWhere: Prisma.OriginalPostWhereInput = {};
  const cleanQuery = filters?.q?.trim() || "";

  if (cleanQuery.length >= 2) {
    filterWhere.OR = [
      { id: cleanQuery },
      { tweetId: cleanQuery },
      { originalPostId: cleanQuery },
      { originalPost: { id: cleanQuery } },
      { originalPost: { tweetId: cleanQuery } },
      { content: { contains: cleanQuery, mode: "insensitive" } },
      {
        originalPost: {
          content: { contains: cleanQuery, mode: "insensitive" },
        },
      },
      {
        originalPost: {
          artist: {
            OR: [
              { name: { contains: cleanQuery, mode: "insensitive" } },
              { handle: { contains: cleanQuery, mode: "insensitive" } },
            ],
          },
        },
      },
      {
        translator: {
          OR: [
            { name: { contains: cleanQuery, mode: "insensitive" } },
            { handle: { contains: cleanQuery, mode: "insensitive" } },
          ],
        },
      },
      {
        originalPost: {
          tags: {
            some: {
              tag: { name: { contains: cleanQuery, mode: "insensitive" } },
            },
          },
        },
      },
    ];
  }

  if (filters?.translator && filters.translator !== "all") {
    filterWhere.translator = { handle: filters.translator };
  }

  if (filters?.artist && filters.artist !== "all") {
    originalPostWhere.artist = { handle: filters.artist };
  }

  if (filters?.tag && filters.tag !== "all") {
    originalPostWhere.tags = { some: { tag: { slug: filters.tag } } };
  }

  if (Object.keys(originalPostWhere).length > 0) {
    filterWhere.originalPost = originalPostWhere;
  }

  // 3. Xác định bài Trước (Prev) và bài Sau (Next) theo chiều Sort
  // 🌟 Chặn không cho Next/Prev nhảy vào các bản dịch khác của chính bài hiện tại
  const excludeCurrentOriginalPost: Prisma.TranslatedPostWhereInput = {
    originalPostId: { not: post.originalPostId },
  };

  const sort = filters?.sort || "newest";
  let prevWhere: Prisma.TranslatedPostWhereInput = {};
  let nextWhere: Prisma.TranslatedPostWhereInput = {};
  let prevOrderBy: Prisma.TranslatedPostOrderByWithRelationInput = {};
  let nextOrderBy: Prisma.TranslatedPostOrderByWithRelationInput = {};

  if (sort === "oldest") {
    prevWhere = {
      ...filterWhere,
      ...excludeCurrentOriginalPost,
      postedAt: { lt: post.postedAt },
    };
    prevOrderBy = { postedAt: "desc" };
    nextWhere = {
      ...filterWhere,
      ...excludeCurrentOriginalPost,
      postedAt: { gt: post.postedAt },
    };
    nextOrderBy = { postedAt: "asc" };
  } else if (sort === "orig_newest") {
    prevWhere = {
      ...filterWhere,
      ...excludeCurrentOriginalPost,
      originalPost: {
        ...originalPostWhere,
        postedAt: { gt: post.originalPost.postedAt },
      },
    };
    prevOrderBy = { originalPost: { postedAt: "asc" } };
    nextWhere = {
      ...filterWhere,
      ...excludeCurrentOriginalPost,
      originalPost: {
        ...originalPostWhere,
        postedAt: { lt: post.originalPost.postedAt },
      },
    };
    nextOrderBy = { originalPost: { postedAt: "desc" } };
  } else if (sort === "orig_oldest") {
    prevWhere = {
      ...filterWhere,
      ...excludeCurrentOriginalPost,
      originalPost: {
        ...originalPostWhere,
        postedAt: { lt: post.originalPost.postedAt },
      },
    };
    prevOrderBy = { originalPost: { postedAt: "desc" } };
    nextWhere = {
      ...filterWhere,
      ...excludeCurrentOriginalPost,
      originalPost: {
        ...originalPostWhere,
        postedAt: { gt: post.originalPost.postedAt },
      },
    };
    nextOrderBy = { originalPost: { postedAt: "asc" } };
  } else {
    // Mặc định (newest): Mới -> Cũ
    prevWhere = {
      ...filterWhere,
      ...excludeCurrentOriginalPost,
      postedAt: { gt: post.postedAt },
    };
    prevOrderBy = { postedAt: "asc" };
    nextWhere = {
      ...filterWhere,
      ...excludeCurrentOriginalPost,
      postedAt: { lt: post.postedAt },
    };
    nextOrderBy = { postedAt: "desc" };
  }

  const [prevPost, nextPost] = await Promise.all([
    prisma.translatedPost.findFirst({
      where: prevWhere,
      orderBy: prevOrderBy,
      select: { originalPostId: true, originalPost: { select: { id: true } } },
    }),
    prisma.translatedPost.findFirst({
      where: nextWhere,
      orderBy: nextOrderBy,
      select: { originalPostId: true, originalPost: { select: { id: true } } },
    }),
  ]);

  const prevId = prevPost?.originalPost?.id || prevPost?.originalPostId || null;
  const nextId = nextPost?.originalPost?.id || nextPost?.originalPostId || null;

  return {
    post: {
      id: post.id,
      origId: post.originalPost.id,
      origTweetId: post.originalPost.tweetId,
      transId: post.tweetId,
      artistName: post.originalPost.artist.name,
      artistHandle: post.originalPost.artist.handle,
      translatorName: post.translator.handle,
      language: post.language,
      tags: post.originalPost.tags.map((pt) => pt.tag),
      postedAt: post.postedAt ?? new Date(),
      origMediaUrls: post.originalPost.mediaUrls,
      transMediaUrls: post.mediaUrls,
    },
    prevId,
    nextId,
  };
}
