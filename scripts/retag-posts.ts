// scripts/retag-posts.ts
import { PrismaClient } from "@prisma/client";
import { autoTagPost } from "../lib/tagger";

const prisma = new PrismaClient();

async function retagAllPosts() {
  console.log("=======================================================");
  console.log("🏷️ Bắt đầu quét và cập nhật lại Tag cho toàn bộ bài viết");
  console.log("=======================================================\n");

  // Truy vấn từ TranslatedPost và include OriginalPost cùng Tags
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

  console.log(`🔍 Tìm thấy tổng cộng: ${translatedPosts.length} bài dịch cần kiểm tra.`);

  let updatedCount = 0;

  for (let i = 0; i < translatedPosts.length; i++) {
    const trans = translatedPosts[i];
    const orig = trans.originalPost;

    if (!orig) {
      console.log(`[${i + 1}/${translatedPosts.length}] Bỏ qua bài [${trans.tweetId}]: Không tìm thấy bài gốc.`);
      continue;
    }

    // Gộp text của cả bài dịch và bài gốc
    const combinedText = `${orig.content || ""} ${trans.content || ""}`.trim();

    if (!combinedText) {
      console.log(`[${i + 1}/${translatedPosts.length}] Bài [${trans.tweetId}]: Không có nội dung text để quét tag.`);
      continue;
    }

    try {
      // Nhận diện và gán tag vào OriginalPost
      await autoTagPost(prisma, orig.id, combinedText);

      // Lấy danh sách tag cập nhật để in log
      const updatedOrig = await prisma.originalPost.findUnique({
        where: { id: orig.id },
        include: {
          tags: {
            include: { tag: true },
          },
        },
      });

      const tagNames = updatedOrig?.tags.map((t) => t.tag.name).join(", ") || "None";
      console.log(`✅ [${i + 1}/${translatedPosts.length}] Tweet [${trans.tweetId}] ➔ Tags: [${tagNames}]`);
      updatedCount++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${translatedPosts.length}] Lỗi cập nhật tag tweet [${trans.tweetId}]:`, err);
    }
  }

  console.log("\n=======================================================");
  console.log(`🎉 Hoàn tất cập nhật tag cho ${updatedCount}/${translatedPosts.length} bài!`);
  console.log("=======================================================");
}

retagAllPosts()
  .catch((e) => {
    console.error("Lỗi thực thi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });