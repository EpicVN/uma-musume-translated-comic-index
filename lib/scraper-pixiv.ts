// lib/scraper-pixiv.ts

export interface PixivScrapedData {
  illustId: string;
  title: string;
  caption: string;
  artistId: string;
  artistName: string;
  artistAccount: string;
  profileUrl: string;
  postedAt: string;
  pageCount: number;
  mediaUrls: string[];
}

/**
 * Trích xuất Illust ID từ URL Pixiv
 * Hỗ trợ: https://www.pixiv.net/artworks/123456
 *         https://www.pixiv.net/en/artworks/123456
 */
export function extractPixivId(url: string): string | null {
  const match = url.match(/artworks\/(\d+)/i) || url.match(/illust_id=(\d+)/i);
  return match ? match[1] : null;
}

/**
 * Cào metadata và link ảnh gốc từ Pixiv Ajax API
 */
export async function scrapePixivMetadata(
  pixivUrl: string,
  cookiePhpsessid?: string, // Truyền PHPSESSID nếu cần cào bài R-18 / yêu cầu login
): Promise<PixivScrapedData | null> {
  const illustId = extractPixivId(pixivUrl);
  if (!illustId) return null;

  try {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: `https://www.pixiv.net/artworks/${illustId}`,
    };

    if (cookiePhpsessid) {
      headers["Cookie"] = `PHPSESSID=${cookiePhpsessid}`;
    }

    // 1. Lấy thông tin chung của tác phẩm & tác giả
    const mainRes = await fetch(
      `https://www.pixiv.net/ajax/illust/${illustId}?lang=en`,
      { headers },
    );

    if (!mainRes.ok) {
      console.error(
        `[Pixiv] Lỗi fetch illust ${illustId}: Status ${mainRes.status}`,
      );
      return null;
    }

    const mainJson = await mainRes.json();
    if (mainJson.error) {
      console.error(`[Pixiv API Error]:`, mainJson.message);
      return null;
    }

    const body = mainJson.body;
    const pageCount: number = body.pageCount || 1;
    const originalPhotos: string[] = [];

    // 2. Lấy link ảnh gốc
    if (pageCount === 1) {
      // 1 ảnh duy nhất
      if (body.urls?.original) {
        originalPhotos.push(body.urls.original);
      }
    } else {
      // Manga / Bộ tranh nhiều trang -> gọi endpoint /pages
      const pagesRes = await fetch(
        `https://www.pixiv.net/ajax/illust/${illustId}/pages?lang=en`,
        { headers },
      );
      if (pagesRes.ok) {
        const pagesJson = await pagesRes.json();
        if (!pagesJson.error && Array.isArray(pagesJson.body)) {
          for (const p of pagesJson.body) {
            if (p.urls?.original) {
              originalPhotos.push(p.urls.original);
            }
          }
        }
      }
    }

    // ⚠️ LƯU Ý VỀ HIỂN THỊ ẢNH (Chống 403 Forbidden):
    // Pixiv chặn hotlink (Referer check). Thay thế host "i.pximg.net" sang proxy công khai "i.pixiv.cat"
    // để web Next.js của bạn có thể tải và render ảnh bình thường.
    const safeMediaUrls = originalPhotos.map((url) =>
      url.replace("i.pximg.net", "i.pixiv.cat"),
    );

    return {
      illustId,
      title: body.title || "",
      caption: body.description || "",
      artistId: body.userId,
      artistName: body.userName || "Pixiv Artist",
      artistAccount: body.userAccount || `pixiv_${body.userId}`,
      profileUrl: `https://www.pixiv.net/users/${body.userId}`,
      postedAt: body.createDate || new Date().toISOString(),
      pageCount,
      mediaUrls: originalPhotos, // Lưu thẳng mảng URL gốc "https://i.pximg.net/..."
    };
  } catch (err) {
    console.error(`[Pixiv Scraper Error] ${pixivUrl}:`, err);
    return null;
  }
}
