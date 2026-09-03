import { PrismaClient } from "@prisma/client";
import { scrapeTweetMetadata } from "../lib/scraper";
import { autoTagPost } from "../lib/tagger";
import { chromium } from "playwright";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const TARGET_HANDLE = "Kuwaiden";

// Khung thời gian quét timeline Kuwaiden
const DATE_WINDOWS = [
  { until: "2026-09-04", since: "2026-07-01" }, // Quý 3/2026
  { until: "2026-07-01", since: "2026-04-01" }, // Quý 2/2026
  { until: "2026-04-01", since: "2026-01-01" }, // Quý 1/2026
  { until: "2026-01-01", since: "2025-10-01" }, // Quý 4/2025
  { until: "2025-10-01", since: "2025-07-01" }, // Quý 3/2025
  { until: "2025-07-01", since: "2025-04-01" }, // Quý 2/2025
  { until: "2025-04-01", since: "2025-01-01" }, // Quý 1/2025
  { until: "2025-01-01", since: "2024-01-01" }, // Năm 2024
  { until: "2024-01-01", since: "2023-01-01" }, // Năm 2023
];

const MAX_SCROLLS_PER_WINDOW = 100;

function extractOriginalTweetUrl(text: string, currentTweetId: string): string | undefined {
  if (!text) return undefined;
  const matches = text.matchAll(
    /https?:\/\/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/gi
  );
  for (const match of matches) {
    if (match[2] !== currentTweetId) {
      return match[0];
    }
  }
  return undefined;
}

// Hàm kiểm tra bài dịch: Ưu tiên UmaTranslations (cả có # lẫn không #), kèm fallback tag tiếng Nhật
function isTargetTranslationPost(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes("umatranslations") ||
    lower.includes("#ウマ娘英訳") ||
    lower.includes("ウマ娘英訳")
  );
}

async function runScrapeKuwaiden() {
  console.log(`=======================================================`);
  console.log(`🚀 Bắt đầu cào dữ liệu & Auto-Tag cho @${TARGET_HANDLE}`);
  console.log(`=======================================================\n`);

  const translator = await prisma.creator.upsert({
    where: { handle: `@${TARGET_HANDLE}` },
    update: {
      isTarget: true,
      filterTags: "#UmaTranslations",
      role: "TRANSLATOR",
    },
    create: {
      handle: `@${TARGET_HANDLE}`,
      name: "KuwaidenTL",
      profileUrl: `https://x.com/${TARGET_HANDLE}`,
      isTarget: true,
      filterTags: "#UmaTranslations",
      role: "TRANSLATOR",
    },
  });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  if (process.env.TWITTER_AUTH_TOKEN && process.env.TWITTER_CT0) {
    await context.addCookies([
      {
        name: "auth_token",
        value: process.env.TWITTER_AUTH_TOKEN,
        domain: ".x.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None",
      },
      {
        name: "ct0",
        value: process.env.TWITTER_CT0,
        domain: ".x.com",
        path: "/",
        secure: true,
        sameSite: "Lax",
      },
    ]);
  }

  const page = await context.newPage();
  const allDiscoveredIds = new Set<string>();

  for (const timeWindow of DATE_WINDOWS) {
    // Tối ưu cú pháp query trên X: OR giữa UmaTranslations và #ウマ娘英訳
    const query = `from:${TARGET_HANDLE} (UmaTranslations OR #ウマ娘英訳) until:${timeWindow.until} since:${timeWindow.since}`;
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;

    console.log(`\n-------------------------------------------------------`);
    console.log(`📅 Quét khung: [${timeWindow.since}  -->  ${timeWindow.until}]`);
    console.log(`🔗 Link: ${searchUrl}`);
    console.log(`-------------------------------------------------------`);

    try {
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(3500);

      let emptyScrollCount = 0;

      for (let scroll = 1; scroll <= MAX_SCROLLS_PER_WINDOW; scroll++) {
        const idsOnPage: string[] = await page.evaluate(() => {
          const articles = Array.from(
            document.querySelectorAll('article[data-testid="tweet"]'),
          );
          const ids: string[] = [];
          articles.forEach((art) => {
            const link = art.querySelector('a[href*="/status/"]');
            if (link) {
              const href = link.getAttribute("href") || "";
              const match = href.match(/status\/(\d+)/);
              if (match) ids.push(match[1]);
            }
          });
          return ids;
        });

        const prevSize = allDiscoveredIds.size;
        idsOnPage.forEach((id) => allDiscoveredIds.add(id));
        const newlyFound = allDiscoveredIds.size - prevSize;

        if (newlyFound === 0) {
          emptyScrollCount++;
          if (emptyScrollCount >= 10) {
            console.log(`   📌 10 lần cuộn không có bài mới. Chuyển khung tiếp theo...`);
            break;
          }
        } else {
          emptyScrollCount = 0;
          console.log(
            `   [Cuộn ${scroll}/${MAX_SCROLLS_PER_WINDOW}] +${newlyFound} tweet mới (Tổng tích lũy: ${allDiscoveredIds.size})`,
          );
        }

        await page.mouse.wheel(0, 2000);
        await page.waitForTimeout(2200);
      }
    } catch (err) {
      console.error(
        `   ⚠️ Lỗi tải khung ${timeWindow.since} -> ${timeWindow.until}:`,
        err,
      );
    }
  }

  await browser.close();

  console.log(`\n=======================================================`);
  console.log(`🎉 Quét xong! Tổng thu thập: ${allDiscoveredIds.size} tweet ID.`);
  console.log(`📦 Đang bóc tách metadata, gắn thẻ nhân vật & lưu Database...`);
  console.log(`=======================================================\n`);

  let savedCount = 0;
  let skippedCount = 0;
  const tweetIdList = Array.from(allDiscoveredIds);

  for (let idx = 0; idx < tweetIdList.length; idx++) {
    const tId = tweetIdList[idx];

    const isExisted = await prisma.translatedPost.findUnique({
      where: { tweetId: tId },
      include: { originalPost: true },
    });

    if (isExisted) {
      skippedCount++;
      continue;
    }

    const transTweetUrl = `https://x.com/${TARGET_HANDLE}/status/${tId}`;
    const transData = await scrapeTweetMetadata(transTweetUrl);

    if (!transData || !transData.hasMedia) {
      continue;
    }

    // Kiểm tra nội dung tweet có chứa từ khóa dịch hay không
    if (!isTargetTranslationPost(transData.text || "")) {
      continue;
    }

    // Nhận diện link bài gốc từ Quote Tweet hoặc link paste trong text
    let originalTweetUrl: string | undefined = transData.quotedTweetUrl;
    if (!originalTweetUrl) {
      originalTweetUrl = extractOriginalTweetUrl(transData.text || "", tId);
    }

    if (!originalTweetUrl) {
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Không tìm thấy link bài gốc`,
      );
      continue;
    }

    const origData = await scrapeTweetMetadata(originalTweetUrl);
    if (!origData) {
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Không lấy được bài gốc từ: ${originalTweetUrl}`,
      );
      continue;
    }

    const artistHandle = origData.handle.startsWith("@") ? origData.handle : `@${origData.handle}`;

    // 1. Upsert Artist
    const artist = await prisma.creator.upsert({
      where: { handle: artistHandle },
      update: { name: origData.name, role: "ARTIST" },
      create: {
        handle: artistHandle,
        name: origData.name,
        profileUrl: `https://x.com/${artistHandle.replace("@", "")}`,
        role: "ARTIST",
      },
    });

    // 2. Upsert OriginalPost
    const originalPost = await prisma.originalPost.upsert({
      where: { tweetId: origData.tweetId },
      update: {
        content: origData.text || "",
      },
      create: {
        tweetId: origData.tweetId,
        tweetUrl: origData.tweetUrl,
        postedAt: new Date(origData.postedAt),
        content: origData.text || "",
        artistId: artist.id,
      },
    });

    // 3. Tự động nhận diện và gán Tag nhân vật
    const combinedText = `${transData.text || ""} ${origData.text || ""}`;
    await autoTagPost(prisma, originalPost.id, combinedText);

    // 4. Create TranslatedPost (lưu text content đầy đủ để phục vụ search)
    await prisma.translatedPost.create({
      data: {
        tweetId: transData.tweetId,
        tweetUrl: transData.tweetUrl,
        language: "en",
        content: transData.text || "",
        postedAt: new Date(transData.postedAt),
        translatorId: translator.id,
        originalPostId: originalPost.id,
      },
    });

    savedCount++;
    console.log(
      `   ✅ [${idx + 1}/${tweetIdList.length}] Đã lưu & gắn tag: ${origData.name} ➔ @${TARGET_HANDLE} (${tId})`,
    );

    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\n=======================================================`);
  console.log(`🏁 HOÀN TẤT CHIẾN DỊCH:`);
  console.log(`   - Tổng ID quét được: ${tweetIdList.length}`);
  console.log(`   - Bỏ qua do đã có trong DB: ${skippedCount}`);
  console.log(`   - Lưu mới thành công: ${savedCount}`);
  console.log(`=======================================================`);
}

runScrapeKuwaiden()
  .catch((err) => console.error("Lỗi thực thi:", err))
  .finally(async () => await prisma.$disconnect());