// scripts/retag-single-post.ts
/// <reference types="node" />

import { PrismaClient, Prisma } from "@prisma/client";
import { autoTagPost } from "../lib/tagger";

const prisma = new PrismaClient();

type TranslatedPostWithOrig = Prisma.TranslatedPostGetPayload<{
  include: {
    originalPost: {
      include: {
        tags: {
          include: {
            tag: true;
          };
        };
      };
    };
  };
}>;

async function retagSinglePost() {
  const targetTweetId = process.argv[2]?.trim();

  if (!targetTweetId) {
    console.error("❌ Thiếu tweetId! Sử dụng cú pháp:");
    console.error("   npx ts-node scripts/retag-single-post.ts <tweetId>\n");
    process.exit(1);
  }

  console.log(`🔍 Đang tìm kiếm bài viết có Tweet ID: [${targetTweetId}]...`);

  // 1. Tìm theo TranslatedPost trước
  let trans: TranslatedPostWithOrig | null = await prisma.translatedPost.findUnique({
    where: { tweetId: targetTweetId },
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

  let orig = trans?.originalPost ?? null;

  // 2. Nếu targetTweetId là ID của OriginalPost
  if (!orig) {
    orig = await prisma.originalPost.findUnique({
      where: { tweetId: targetTweetId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (orig) {
      trans = await prisma.translatedPost.findFirst({
        where: { originalPostId: orig.id },
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
    }
  }

  if (!orig) {
    console.error(
      `❌ Không tìm thấy bài viết nào trong Database có Tweet ID [${targetTweetId}].`
    );
    return;
  }

  // Kết hợp text từ cả OriginalPost và TranslatedPost để quét tag
  const combinedText = `${orig.content || ""} ${trans?.content || ""}`.trim();

  if (!combinedText) {
    console.warn(
      `⚠️ Post [${targetTweetId}] không có nội dung text nào để phân tích tag.`
    );
    return;
  }

  const oldTags =
    orig.tags.map((t) => t.tag.name).join(", ") || "None";
  console.log(`📌 Tags hiện tại: [${oldTags}]`);

  // Phân tích và gán lại tag tự động
  await autoTagPost(prisma, orig.id, combinedText);

  // Truy vấn lại danh sách tag mới sau khi cập nhật
  const updatedOrig = await prisma.originalPost.findUnique({
    where: { id: orig.id },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  const newTags =
    updatedOrig?.tags.map((t) => t.tag.name).join(", ") || "None";

  console.log("\n=======================================================");
  console.log(`✅ Cập nhật tag thành công cho Tweet [${targetTweetId}]!`);
  console.log(`🏷️ Tags mới: [${newTags}]`);
  console.log("=======================================================");
}

retagSinglePost()
  .catch((e) => {
    console.error("Execution error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });