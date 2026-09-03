// scripts/sync-content.ts
import { PrismaClient } from '@prisma/client';
import { getTweet } from 'react-tweet/api';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Đang quét các bài post có content bị null...');

  // 1. Tìm tất cả TranslatedPost chưa có content
  const translatedPosts = await prisma.translatedPost.findMany({
    where: {
      OR: [{ content: null }, { content: '' }],
    },
  });

  console.log(`Tìm thấy ${translatedPosts.length} bài TranslatedPost cần cập nhật.`);

  for (const post of translatedPosts) {
    try {
      const tweet = await getTweet(post.tweetId);
      if (tweet && tweet.text) {
        await prisma.translatedPost.update({
          where: { id: post.id },
          data: { content: tweet.text },
        });
        console.log(`✅ Đã cập nhật TransPost [${post.tweetId}]: ${tweet.text.slice(0, 40)}...`);
      }
    } catch (err) {
      console.error(`❌ Lỗi fetch tweet [${post.tweetId}]:`, err);
    }
  }

  // 2. Tìm tất cả OriginalPost chưa có content
  const originalPosts = await prisma.originalPost.findMany({
    where: {
      OR: [{ content: null }, { content: '' }],
    },
  });

  console.log(`Tìm thấy ${originalPosts.length} bài OriginalPost cần cập nhật.`);

  for (const post of originalPosts) {
    try {
      const tweet = await getTweet(post.tweetId);
      if (tweet && tweet.text) {
        await prisma.originalPost.update({
          where: { id: post.id },
          data: { content: tweet.text },
        });
        console.log(`✅ Đã cập nhật OrigPost [${post.tweetId}]: ${tweet.text.slice(0, 40)}...`);
      }
    } catch (err) {
      console.error(`❌ Lỗi fetch tweet gốc [${post.tweetId}]:`, err);
    }
  }

  console.log('🎉 Hoàn tất đồng bộ toàn bộ content!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });