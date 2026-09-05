import { PrismaClient } from "@prisma/client";
import charactersData from "../config/characters.json";

export interface UmaCharacter {
  slug: string;
  name: string;
  jp: string;
  aliases?: string[];
}

export const CHARACTER_DICTIONARY: UmaCharacter[] = charactersData;

// Escape các ký tự đặc biệt nếu alias chứa ký tự Regex
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Kiểm tra so khớp từ độc lập, bảo vệ không bị ăn vào từ có dấu nháy đơn (như Don't, Won't)
function matchWordBoundary(text: string, keyword: string): boolean {
  // Nếu là chữ Nhật/Hán tự: so khớp thẳng chuỗi con vì tiếng Nhật không có khoảng trắng
  const isCJK =
    /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(
      keyword,
    );
  if (isCJK) {
    return text.includes(keyword);
  }

  const escaped = escapeRegExp(keyword);
  // (?!['’\w]): Chặn nếu phía sau ngay lập tức là dấu nháy đơn hoặc chữ cái (chặn triệt để Don't, Don't, Donne...)
  // (?<!['’\w]): Chặn nếu phía trước có chữ cái hoặc dấu nháy
  const regex = new RegExp(`(?<!['’\\w])${escaped}(?!['’\\w])`, "i");
  return regex.test(text);
}

export async function autoTagPost(
  prisma: PrismaClient,
  postId: string,
  fullText: string,
) {
  if (!fullText) return;

  const matchedChars: UmaCharacter[] = [];

  // 1. Quét bộ từ điển trong bộ nhớ trước
  for (const char of CHARACTER_DICTIONARY) {
    let isMatched = false;

    // So khớp tiếng Nhật
    if (char.jp && fullText.includes(char.jp)) {
      isMatched = true;
    }

    // So khớp tên tiếng Anh chính thức
    if (!isMatched && matchWordBoundary(fullText, char.name)) {
      isMatched = true;
    }

    // So khớp danh sách aliases
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

  if (matchedChars.length === 0) return;

  // 2. Tối ưu truy vấn DB bằng Transaction theo lô
  await prisma.$transaction(async (tx) => {
    for (const char of matchedChars) {
      // Tìm tag đã tồn tại theo name hoặc slug để tránh xung đột Unique constraint
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
