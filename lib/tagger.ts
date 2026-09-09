import { PrismaClient } from "@prisma/client";
import charactersData from "../config/characters.json";

export interface UmaCharacter {
  slug: string;
  name: string;
  jp: string;
  aliases?: string[];
}

export const CHARACTER_DICTIONARY: UmaCharacter[] = charactersData;

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchWordBoundary(text: string, keyword: string): boolean {
  const isCJK =
    /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(
      keyword,
    );
  if (isCJK) {
    return text.includes(keyword);
  }

  const escaped = escapeRegExp(keyword);
  const regex = new RegExp(`(?<!['’\\w])${escaped}(?!['’\\w])`, "i");
  return regex.test(text);
}

// Hàm thuần túy dùng cho cả test case lẫn autoTagPost
export function matchCharacters(
  fullText: string,
  dictionary: UmaCharacter[] = CHARACTER_DICTIONARY,
): UmaCharacter[] {
  if (!fullText) return [];

  const matchedChars: UmaCharacter[] = [];

  for (const char of dictionary) {
    let isMatched = false;

    if (char.jp && fullText.includes(char.jp)) {
      isMatched = true;
    }

    if (!isMatched && matchWordBoundary(fullText, char.name)) {
      isMatched = true;
    }

    if (!isMatched && char.aliases && char.aliases.length > 0) {
      for (const alias of char.aliases) {
        if (matchWordBoundary(fullText, alias)) {
          isMatched = true;
          break;
        }
      }
    }

    if (isMatched) {
      matchedChars.push(char);
    }
  }

  return matchedChars;
}

export async function autoTagPost(
  prisma: PrismaClient,
  postId: string,
  fullText: string,
) {
  const matchedChars = matchCharacters(fullText);
  if (matchedChars.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const char of matchedChars) {
      let tag = await tx.tag.findFirst({
        where: {
          OR: [{ slug: char.slug }, { name: char.name }],
        },
      });

      if (!tag) {
        tag = await tx.tag.create({
          data: {
            slug: char.slug,
            name: char.name,
            jpName: char.jp,
            category: "CHARACTER",
          },
        });
      }

      await tx.postTag.upsert({
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
  });
}