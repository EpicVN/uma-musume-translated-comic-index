// scripts/sync-characters.ts
import { PrismaClient } from "@prisma/client";
import rawCharacters from "../config/characters.json";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

interface CharacterItem {
  slug: string;
  name: string;
  jp?: string;
  aliases?: string[];
}

const characters = rawCharacters as CharacterItem[];

async function syncCharacters() {
  console.log(
    `⏳ Bắt đầu đồng bộ ${characters.length} nhân vật từ characters.json...`,
  );

  let syncedCount = 0;

  for (const char of characters) {
    if (!char.name || !char.slug) continue;

    await prisma.tag.upsert({
      where: { name: char.name },
      update: {
        slug: char.slug,
        category: "CHARACTER",
      },
      create: {
        name: char.name,
        slug: char.slug,
        category: "CHARACTER",
      },
    });

    syncedCount++;
  }

  console.log("✅ Đồng bộ hoàn tất thành công!");
  console.log(`📊 Đã xử lý: ${syncedCount} nhân vật trong bảng Tag.`);
}

syncCharacters()
  .catch((err) => {
    console.error("❌ Lỗi khi đồng bộ nhân vật:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
