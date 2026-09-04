// scripts/sync-content.ts
import { PrismaClient } from "@prisma/client";
import { getTweet } from "react-tweet/api";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Scanning posts with missing or empty content...");

  // 1. Fetch all TranslatedPost records missing content
  const translatedPosts = await prisma.translatedPost.findMany({
    where: {
      OR: [{ content: null }, { content: "" }],
    },
  });

  console.log(
    `Found ${translatedPosts.length} TranslatedPost records requiring update.`,
  );

  for (const post of translatedPosts) {
    try {
      const tweet = await getTweet(post.tweetId);
      if (tweet && tweet.text) {
        await prisma.translatedPost.update({
          where: { id: post.id },
          data: { content: tweet.text },
        });
        console.log(
          `✅ Updated TransPost [${post.tweetId}]: ${tweet.text.slice(0, 40)}...`,
        );
      }
    } catch (err) {
      console.error(`❌ Error fetching tweet [${post.tweetId}]:`, err);
    }
  }

  // 2. Fetch all OriginalPost records missing content
  const originalPosts = await prisma.originalPost.findMany({
    where: {
      OR: [{ content: null }, { content: "" }],
    },
  });

  console.log(
    `Found ${originalPosts.length} OriginalPost records requiring update.`,
  );

  for (const post of originalPosts) {
    try {
      const tweet = await getTweet(post.tweetId);
      if (tweet && tweet.text) {
        await prisma.originalPost.update({
          where: { id: post.id },
          data: { content: tweet.text },
        });
        console.log(
          `✅ Updated OrigPost [${post.tweetId}]: ${tweet.text.slice(0, 40)}...`,
        );
      }
    } catch (err) {
      console.error(`❌ Error fetching original tweet [${post.tweetId}]:`, err);
    }
  }

  console.log("🎉 Successfully synced all post content!");
}

main()
  .catch((e) => {
    console.error("Execution error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
