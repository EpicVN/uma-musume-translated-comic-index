// scripts/retag-posts.ts
import { PrismaClient } from "@prisma/client";
import { autoTagPost } from "../lib/tagger";

const prisma = new PrismaClient();

async function retagAllPosts() {
  console.log("=======================================================");
  console.log("🏷️ Starting re-scanning and tag update for all posts");
  console.log("=======================================================\n");

  // Query TranslatedPost records including OriginalPost and associated Tags
  const translatedPosts = await prisma.translatedPost.findMany({
    include: {
      originalPost: {
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      },
    },
  });

  console.log(
    `🔍 Found total: ${translatedPosts.length} translated posts to check.`,
  );

  let updatedCount = 0;

  for (let i = 0; i < translatedPosts.length; i++) {
    const trans = translatedPosts[i];
    const orig = trans.originalPost;

    if (!orig) {
      console.log(
        `[${i + 1}/${translatedPosts.length}] Skipped post [${trans.tweetId}]: Original post not found.`,
      );
      continue;
    }

    // Merge content from both original and translated posts
    const combinedText = `${orig.content || ""} ${trans.content || ""}`.trim();

    if (!combinedText) {
      console.log(
        `[${i + 1}/${translatedPosts.length}] Post [${trans.tweetId}]: No text content available for tag detection.`,
      );
      continue;
    }

    try {
      // Detect and assign tags to OriginalPost
      await autoTagPost(prisma, orig.id, combinedText);

      // Fetch updated tags for logging
      const updatedOrig = await prisma.originalPost.findUnique({
        where: { id: orig.id },
        include: {
          tags: {
            include: { tag: true },
          },
        },
      });

      const tagNames =
        updatedOrig?.tags.map((t) => t.tag.name).join(", ") || "None";
      console.log(
        `✅ [${i + 1}/${translatedPosts.length}] Tweet [${trans.tweetId}] ➔ Tags: [${tagNames}]`,
      );
      updatedCount++;
    } catch (err) {
      console.error(
        `❌ [${i + 1}/${translatedPosts.length}] Error updating tags for tweet [${trans.tweetId}]:`,
        err,
      );
    }
  }

  console.log("\n=======================================================");
  console.log(
    `🎉 Successfully updated tags for ${updatedCount}/${translatedPosts.length} posts!`,
  );
  console.log("=======================================================");
}

retagAllPosts()
  .catch((e) => {
    console.error("Execution error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
