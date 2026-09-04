// scripts/transfer-to-neon.ts
import { PrismaClient as LocalPrisma } from "@prisma/client";
import { PrismaClient as NeonPrisma } from "@prisma/client";

const LOCAL_DB_URL =
  "postgresql://postgres:123456@127.0.0.1:5432/comic_indexer?schema=public";

// Use Direct URL (without '-pooler') for smooth bulk script migration
const NEON_DB_URL =
  "postgresql://neondb_owner:npg_2n3fTOjaEZSQ@ep-aged-brook-b3m0gqdb.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const localClient = new LocalPrisma({
  datasources: { db: { url: LOCAL_DB_URL } },
});
const neonClient = new NeonPrisma({
  datasources: { db: { url: NEON_DB_URL } },
});

async function transfer() {
  console.log("🚀 Starting data migration from Local to Neon DB...");

  // 1. Migrate Creator table (Artists & Translators)
  console.log("📦 Migrating Creators...");
  const creators = await localClient.creator.findMany();
  for (const item of creators) {
    await neonClient.creator.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log(`✅ Migrated ${creators.length} Creators.`);

  // 2. Migrate Tag table (Characters)
  console.log("📦 Migrating Tags...");
  const tags = await localClient.tag.findMany();
  for (const item of tags) {
    await neonClient.tag.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log(`✅ Migrated ${tags.length} Tags.`);

  // 3. Migrate OriginalPost table
  console.log("📦 Migrating OriginalPosts...");
  const originalPosts = await localClient.originalPost.findMany();
  for (const item of originalPosts) {
    await neonClient.originalPost.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log(`✅ Migrated ${originalPosts.length} OriginalPosts.`);

  // 4. Migrate TranslatedPost table
  console.log("📦 Migrating TranslatedPosts...");
  const translatedPosts = await localClient.translatedPost.findMany();
  for (const item of translatedPosts) {
    await neonClient.translatedPost.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log(`✅ Migrated ${translatedPosts.length} TranslatedPosts.`);

  // 5. Migrate Post-Tag relationship table (PostTag)
  try {
    if (localClient.postTag) {
      console.log("📦 Migrating PostTag associations...");

      const postTags = await localClient.postTag.findMany();

      await neonClient.postTag.deleteMany({});

      const result = await neonClient.postTag.createMany({
        data: postTags,
        skipDuplicates: true,
      });

      console.log(`✅ Seeded ${result.count} PostTag associations.`);
    }
  } catch (err) {
    console.error("⚠️ Error migrating PostTag table:", err);
  }

  console.log("\n🎉 FULL DATA MIGRATION FROM LOCAL TO NEON COMPLETED!");
}

// Execute transfer at root level
transfer()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await localClient.$disconnect();
    await neonClient.$disconnect();
  });
