// scripts/transfer-to-neon.ts
import { PrismaClient as LocalPrisma } from "@prisma/client";
import { PrismaClient as NeonPrisma } from "@prisma/client";

const LOCAL_DB_URL =
  "postgresql://postgres:123456@127.0.0.1:5432/comic_indexer?schema=public";

// Dùng Direct URL (bỏ -pooler) để import script mượt mà
const NEON_DB_URL =
  "postgresql://neondb_owner:npg_2n3fTOjaEZSQ@ep-aged-brook-b3m0gqdb.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const localClient = new LocalPrisma({
  datasources: { db: { url: LOCAL_DB_URL } },
});
const neonClient = new NeonPrisma({
  datasources: { db: { url: NEON_DB_URL } },
});

async function transfer() {
  console.log("🚀 Bắt đầu chuyển dữ liệu từ Local lên Neon...");

  // 1. Chuyển bảng Creator (Artist & Translator)
  console.log("📦 Đang chuyển Creator...");
  const creators = await localClient.creator.findMany();
  for (const item of creators) {
    await neonClient.creator.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log(`✅ Đã chuyển ${creators.length} Creator.`);

  // 2. Chuyển bảng Tag (Nhân vật)
  console.log("📦 Đang chuyển Tag...");
  const tags = await localClient.tag.findMany();
  for (const item of tags) {
    await neonClient.tag.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log(`✅ Đã chuyển ${tags.length} Tag.`);

  // 3. Chuyển OriginalPost
  console.log("📦 Đang chuyển OriginalPost...");
  const originalPosts = await localClient.originalPost.findMany();
  for (const item of originalPosts) {
    await neonClient.originalPost.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log(`✅ Đã chuyển ${originalPosts.length} OriginalPost.`);

  // 4. Chuyển TranslatedPost
  console.log("📦 Đang chuyển TranslatedPost...");
  const translatedPosts = await localClient.translatedPost.findMany();
  for (const item of translatedPosts) {
    await neonClient.translatedPost.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log(`✅ Đã chuyển ${translatedPosts.length} TranslatedPost.`);

  // 5. Chuyển quan hệ gán Tag (PostTag)
  try {
    if (localClient.postTag) {
      console.log("📦 Đang chuyển PostTag...");

      const postTags = await localClient.postTag.findMany();

      await neonClient.postTag.deleteMany({});

      const result = await neonClient.postTag.createMany({
        data: postTags,
        skipDuplicates: true,
      });

      console.log(`✅ Đã nạp ${result.count} liên kết PostTag.`);
    }
  } catch (err) {
    console.error("⚠️ Lỗi chuyển bảng PostTag:", err);
  }

  console.log("\n🎉 HOÀN TẤT ĐỒNG BỘ TOÀN BỘ DỮ LIỆU TỪ LOCAL LÊN NEON!");
}

// Gọi hàm ở cấp root ngoài cùng
transfer()
  .catch((e) => {
    console.error("Lỗi đồng bộ:", e);
    process.exit(1);
  })
  .finally(async () => {
    await localClient.$disconnect();
    await neonClient.$disconnect();
  });