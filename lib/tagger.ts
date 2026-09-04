import { PrismaClient } from "@prisma/client";
import charactersData from "../config/characters.json";

export interface UmaCharacter {
  slug: string;
  name: string;
  jp: string;
  aliases?: string[];
}

export const CHARACTER_DICTIONARY: UmaCharacter[] = charactersData;

export async function autoTagPost(
  prisma: PrismaClient,
  postId: string,
  fullText: string,
) {
  if (!fullText) return;

  const normalized = fullText.toLowerCase();

  for (const char of CHARACTER_DICTIONARY) {
    let isMatched = false;

    // 1. So khớp tên Katakana tiếng Nhật
    if (fullText.includes(char.jp)) {
      isMatched = true;
    }

    // 2. So khớp tên tiếng Anh đầy đủ
    if (!isMatched && normalized.includes(char.name.toLowerCase())) {
      isMatched = true;
    }

    // 3. So khớp slug hoặc các alias/nickname (có regex word boundary)
    if (!isMatched && char.aliases) {
      for (const alias of char.aliases) {
        const regex = new RegExp(`\\b${alias}\\b`, "i");
        if (regex.test(fullText)) {
          isMatched = true;
          break;
        }
      }
    }

    if (isMatched) {
      // Upsert tag
      const tag = await prisma.tag.upsert({
        where: { slug: char.slug },
        update: {},
        create: {
          slug: char.slug,
          name: char.name,
          jpName: char.jp,
          category: "CHARACTER",
        },
      });

      // Gán tag vào OriginalPost
      await prisma.postTag.upsert({
        where: {
          postId_tagId: { postId, tagId: tag.id },
        },
        update: {},
        create: {
          postId,
          tagId: tag.id,
          isManual: false,
        },
      });
    }
  }
}