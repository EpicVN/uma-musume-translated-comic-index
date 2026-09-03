// app/page.tsx
import { PrismaClient, Prisma } from '@prisma/client';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import TweetGridCard from '@/components/TweetGridCard';

const prisma = new PrismaClient();
const PAGE_SIZE = 12;

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
  const searchQuery = params.q || '';
  const tagSlug = params.tag || '';
  const artistHandle = params.artist || '';
  const translatorHandle = params.translator || '';
  const sortBy = params.sort === 'oldest' ? 'asc' : 'desc';

  const where: Prisma.TranslatedPostWhereInput = {};
  const originalPostWhere: Prisma.OriginalPostWhereInput = {};

  if (searchQuery) {
    where.OR = [
      { content: { contains: searchQuery, mode: 'insensitive' } },
      { originalPost: { content: { contains: searchQuery, mode: 'insensitive' } } },
    ];
  }

  if (translatorHandle && translatorHandle !== 'all') {
    where.translator = { handle: translatorHandle };
  }

  if (artistHandle && artistHandle !== 'all') {
    originalPostWhere.artist = { handle: artistHandle };
  }

  if (tagSlug && tagSlug !== 'all') {
    originalPostWhere.tags = { some: { tag: { slug: tagSlug } } };
  }

  if (Object.keys(originalPostWhere).length > 0) {
    where.originalPost = originalPostWhere;
  }

  const [totalCount, posts, allTags, artists, translators] = await Promise.all([
    prisma.translatedPost.count({ where }),
    prisma.translatedPost.findMany({
      where,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { postedAt: sortBy },
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
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
    prisma.creator.findMany({
      where: { originalPosts: { some: {} } },
      orderBy: { name: 'asc' },
    }),
    prisma.creator.findMany({
      where: { translatedPosts: { some: {} } },
      orderBy: { name: 'asc' },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <main className="min-h-screen bg-[#0b1622] text-[#bcbedc] px-4 sm:px-8 md:px-12 py-8">
      {/* Header Bar AniList */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#1e2d42]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#3db4f2] flex items-center justify-center font-black text-white text-xl shadow-lg shadow-[#3db4f2]/30">
            U
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">UmaIndex</h1>
            <p className="text-xs text-[#8ba0b2]">Uma Musume Translated Comic Archive</p>
          </div>
        </div>

        <div className="text-xs font-semibold text-[#8ba0b2] bg-[#151f2e] px-3.5 py-1.5 rounded-full border border-[#27364b]">
          Total: <span className="text-[#3db4f2] font-bold">{totalCount}</span> Comics
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar tags={allTags} artists={artists} translators={translators} />

      {/* Grid Manga: 3 đến 4 cột giúp tranh to rõ */}
      {posts.length === 0 ? (
        <div className="text-center py-20 bg-[#151f2e] rounded-xl border border-[#1e2d42]">
          <p className="text-lg text-[#8ba0b2]">No translated manga found.</p>
          <p className="text-sm text-[#5a6f82] mt-1">Try resetting or adjusting the filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 items-start">
          {posts.map((post) => (
            <TweetGridCard
              key={post.id}
              origId={post.originalPost.tweetId}
              transId={post.tweetId}
              artistName={post.originalPost.artist.name}
              translatorName={post.translator.handle}
              language={post.language}
              tags={post.originalPost.tags.map((pt) => pt.tag)}
              postedAt={post.postedAt}
            />
          ))}
        </div>
      )}

      {/* Phân trang */}
      <Pagination currentPage={currentPage} totalPages={totalPages} />
    </main>
  );
}