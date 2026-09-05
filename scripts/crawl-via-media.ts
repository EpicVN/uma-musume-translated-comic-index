import { PrismaClient } from "@prisma/client";
import { scrapeTweetMetadata, TweetData } from "../lib/scraper";
import { autoTagPost } from "../lib/tagger";
import { chromium, BrowserContext, Page, Response } from "playwright";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// ==========================================
// CẤU HÌNH TÀI KHOẢN CẦN CÀO THEO PROFILE
// ==========================================
const TARGET_PROFILE = {
  name: "ImSimon!93.7",
  handle: "simonrojas937", // Không có dấu @
  language: "en",
  keywords: ["UmaTranslations", "ウマ娘英訳"],
  requireKeywordMatch: true,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractOriginalTweetUrl(
  text: string,
  currentTweetId: string,
): string | undefined {
  if (!text) return undefined;
  const matches = text.matchAll(
    /https?:\/\/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/gi,
  );
  for (const match of matches) {
    if (match[2] !== currentTweetId) {
      return match[0];
    }
  }
  return undefined;
}

function matchesTranslationKeywords(text: string, keywords: string[]): boolean {
  if (!TARGET_PROFILE.requireKeywordMatch) return true;
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// Bắt gói tin mạng GraphQL và click mở cờ nhạy cảm để lấy URL bài gốc 18+
async function fetchOriginalTweetUrlWithNetwork(
  context: BrowserContext,
  transTweetUrl: string,
  currentTweetId: string,
): Promise<string | undefined> {
  const page = await context.newPage();
  let originalUrl: string | undefined = undefined;

  const responseHandler = async (response: Response) => {
    try {
      const url = response.url();
      if (
        url.includes("/graphql/") &&
        (url.includes("TweetDetail") || url.includes("TweetResultByRestId"))
      ) {
        const json = await response.json();
        const textData = JSON.stringify(json);

        const matches = textData.matchAll(/"rest_id":"(\d+)"/g);
        for (const match of matches) {
          const foundId = match[1];
          if (foundId !== currentTweetId) {
            const screenNameMatch =
              textData.match(
                new RegExp(`"screen_name":"([^"]+)".*?"rest_id":"${foundId}"`),
              ) ||
              textData.match(
                new RegExp(`"rest_id":"${foundId}".*?"screen_name":"([^"]+)"`),
              );
            const screenName = screenNameMatch ? screenNameMatch[1] : "i";
            originalUrl = `https://x.com/${screenName}/status/${foundId}`;
            break;
          }
        }
      }
    } catch {
      // Bỏ qua lỗi parse các request phụ
    }
  };

  page.on("response", responseHandler);

  try {
    await page.goto(transTweetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Nếu quote bị che bởi cờ 18+, click nút View/Show
    const sensitiveBtn = page
      .locator(
        'button:has-text("View"), button:has-text("Show"), div[role="button"]:has-text("View")',
      )
      .first();

    if (await sensitiveBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await sensitiveBtn.click();
      await page.waitForTimeout(1500);
    }

    if (!originalUrl) {
      originalUrl = await page.evaluate((currId) => {
        const links = Array.from(
          document.querySelectorAll('article[data-testid="tweet"] a[href*="/status/"]'),
        );
        for (const link of links) {
          const href = link.getAttribute("href") || "";
          const match = href.match(
            /(?:twitter\.com|x\.com)?\/([a-zA-Z0-9_]+)\/status\/(\d+)/i,
          );
          if (match && match[2] !== currId) {
            return `https://x.com/${match[1]}/status/${match[2]}`;
          }
        }
        return undefined;
      }, currentTweetId);
    }
  } catch (err) {
    console.error(`   ⚠️ Lỗi khi quét DOM/Network tìm link gốc:`, err);
  } finally {
    page.off("response", responseHandler);
    await page.close().catch(() => {});
  }

  return originalUrl;
}

// Fallback bóc tách metadata bài gốc 18+ bằng Playwright Browser (đã nạp cookie)
async function scrapeNSFWOriginalTweetWithBrowser(
  context: BrowserContext,
  tweetUrl: string,
): Promise<TweetData | null> {
  const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
  if (!tweetIdMatch) return null;
  const tweetId = tweetIdMatch[1];

  const page = await context.newPage();

  try {
    await page.goto(tweetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2500);

    const sensitiveBtn = page
      .locator(
        'button:has-text("View"), button:has-text("Show"), div[role="button"]:has-text("View")',
      )
      .first();

    if (await sensitiveBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await sensitiveBtn.click();
      await page.waitForTimeout(1000);
    }

    const metadata = await page.evaluate((id) => {
      const art = document.querySelector('article[data-testid="tweet"]');
      if (!art) return null;

      const userBlock = art.querySelector('[data-testid="User-Name"]');
      const name =
        userBlock?.querySelector("span")?.textContent || "Unknown Artist";
      const handleMatch = userBlock?.textContent?.match(/@([a-zA-Z0-9_]+)/);
      const handle = handleMatch ? `@${handleMatch[1]}` : "@unknown";

      const textEl = art.querySelector('[data-testid="tweetText"]');
      const text = textEl?.textContent || "";

      const timeEl = art.querySelector("time");
      const postedAt =
        timeEl?.getAttribute("datetime") || new Date().toISOString();

      return {
        tweetId: id,
        tweetUrl: window.location.href,
        name,
        handle,
        postedAt,
        text,
        hasMedia: true,
      };
    }, tweetId);

    return metadata;
  } catch (err) {
    console.error(`   ⚠️ Lỗi cào bài gốc NSFW qua Browser [${tweetId}]:`, err);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

async function discoverTweetIdsFromProfile(
  context: BrowserContext,
  handle: string,
): Promise<string[]> {
  const page = await context.newPage();
  const discoveredIds = new Set<string>();

  // Khởi tạo trỏ thẳng vào tab Photos
  const profilePhotoUrl = `https://x.com/${handle}/media?filter=photo`;

  console.log(`\n🔍 Mở Tab Photos của tác giả: ${profilePhotoUrl}`);

  const responseHandler = async (res: Response) => {
    try {
      const url = res.url();
      if (
        url.includes("/graphql/") &&
        (url.includes("UserMedia") || url.includes("UserTweets"))
      ) {
        const json = await res.json();
        const textData = JSON.stringify(json);

        const matches = textData.matchAll(/"rest_id":"(\d+)"/g);
        for (const m of matches) {
          discoveredIds.add(m[1]);
        }
      }
    } catch {
      // Bỏ qua lỗi parse
    }
  };

  page.on("response", responseHandler);

  try {
    await page.goto(profilePhotoUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    // Kiểm tra nếu giao diện bị chuyển hướng sang "Videos"
    const currentUrl = page.url();
    const isVideoTab =
      currentUrl.includes("filter=video") ||
      (await page
        .locator('div[role="tab"][aria-selected="true"]:has-text("Videos")')
        .isVisible()
        .catch(() => false));

    if (isVideoTab) {
      console.log(`⚠️ Giao diện đang trỏ vào tab Videos, tiến hành chuyển sang Photos...`);

      const videoDropdown = page
        .locator('div[role="tab"]:has-text("Videos"), button:has-text("Videos")')
        .first();

      if (await videoDropdown.isVisible().catch(() => false)) {
        await videoDropdown.click();
        await page.waitForTimeout(600);

        const photosMenuItem = page
          .locator(
            '[role="menuitem"]:has-text("Photos"), div[role="button"]:has-text("Photos")',
          )
          .first();

        if (await photosMenuItem.isVisible().catch(() => false)) {
          await photosMenuItem.click();
          await page.waitForTimeout(2000);
        }
      } else {
        await page.goto(`https://x.com/${handle}/media?filter=photo`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForTimeout(2500);
      }
    }

    let emptyScrollCount = 0;
    let lastSize = 0;
    let scrollCount = 0;

    while (true) {
      scrollCount++;

      const idsOnPage: string[] = await page.evaluate((authorHandle) => {
        const links = Array.from(
          document.querySelectorAll(`a[href*="/${authorHandle}/status/"]`),
        );
        const ids: string[] = [];
        links.forEach((l) => {
          const href = l.getAttribute("href") || "";
          const match = href.match(/status\/(\d+)/);
          if (match) ids.push(match[1]);
        });
        return ids;
      }, handle.toLowerCase());

      idsOnPage.forEach((id) => discoveredIds.add(id));

      const newlyFound = discoveredIds.size - lastSize;

      if (newlyFound === 0) {
        emptyScrollCount++;

        // Kỹ thuật Scroll Bounce: Cuộn nhẹ lên rồi cuộn sâu xuống để kích hoạt cursor tiếp theo
        await page.mouse.wheel(0, -600);
        await page.waitForTimeout(600);
        await page.mouse.wheel(0, 3500);

        if (emptyScrollCount >= 15) {
          console.log(
            `🛑 Không còn tweet mới sau 15 lần thử. Đã cào hết toàn bộ Photos Timeline.`,
          );
          break;
        }
      } else {
        emptyScrollCount = 0;
        lastSize = discoveredIds.size;
        console.log(
          `   [Cuộn lần ${scrollCount}] +${newlyFound} ID mới | Tổng tích lũy: ${discoveredIds.size} tweets`,
        );
      }

      // Cứ mỗi 40 lần cuộn: Dọn bớt các node tweet cũ trên DOM để chống tràn RAM
      if (scrollCount % 40 === 0) {
        await page.evaluate(() => {
          const articles = document.querySelectorAll('article[data-testid="tweet"]');
          for (let i = 0; i < articles.length - 15; i++) {
            articles[i].remove();
          }
        });
      }

      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(1600);
    }
  } catch (err) {
    console.error(`⚠️ Lỗi trong quá trình cuộn timeline media @${handle}:`, err);
  } finally {
    page.off("response", responseHandler);
    await page.close().catch(() => {});
  }

  return Array.from(discoveredIds);
}

async function main() {
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

  console.log(`=======================================================`);
  console.log(`🚀 PROFILE SCRAPER: @${TARGET_PROFILE.handle}`);
  console.log(`=======================================================`);

  const translatorHandle = `@${TARGET_PROFILE.handle}`;
  const translator = await prisma.creator.upsert({
    where: { handle: translatorHandle },
    update: {
      name: TARGET_PROFILE.name,
      isTarget: true,
      filterTags: TARGET_PROFILE.keywords.join(", "),
      role: "TRANSLATOR",
    },
    create: {
      handle: translatorHandle,
      name: TARGET_PROFILE.name,
      profileUrl: `https://x.com/${TARGET_PROFILE.handle}`,
      isTarget: true,
      filterTags: TARGET_PROFILE.keywords.join(", "),
      role: "TRANSLATOR",
    },
  });

  const tweetIdList = await discoverTweetIdsFromProfile(
    context,
    TARGET_PROFILE.handle,
  );
  console.log(
    `\n📦 Đã bóc tách được ${tweetIdList.length} tweet ID. Đang xử lý metadata...`,
  );

  let savedCount = 0;
  let skippedCount = 0;

  for (let idx = 0; idx < tweetIdList.length; idx++) {
    const tId = tweetIdList[idx];

    const isExisted = await prisma.translatedPost.findUnique({
      where: { tweetId: tId },
      select: { id: true },
    });

    if (isExisted) {
      skippedCount++;
      continue;
    }

    const transTweetUrl = `https://x.com/${TARGET_PROFILE.handle}/status/${tId}`;
    const transData = await scrapeTweetMetadata(transTweetUrl, true);

    if (!transData || !transData.hasMedia) {
      continue;
    }

    if (
      !matchesTranslationKeywords(transData.text || "", TARGET_PROFILE.keywords)
    ) {
      continue;
    }

    let originalTweetUrl: string | undefined = transData.quotedTweetUrl;

    if (!originalTweetUrl) {
      originalTweetUrl = extractOriginalTweetUrl(transData.text || "", tId);
    }

    // Fallback: Mở tab độc lập bắt qua GraphQL/DOM nếu quote bị cờ 18+ che giấu
    if (!originalTweetUrl) {
      console.log(
        `   🔍 [${idx + 1}/${tweetIdList.length}] Bài quote bị che bởi cờ nhạy cảm, mở browser dò tìm qua Network/DOM...`,
      );
      originalTweetUrl = await fetchOriginalTweetUrlWithNetwork(
        context,
        transTweetUrl,
        tId,
      );
    }

    if (!originalTweetUrl) {
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Không tìm thấy link bài gốc`,
      );
      continue;
    }

    // Lấy metadata bài gốc (Syndication -> Fallback tab riêng nếu dính cờ 18+)
    let origData: TweetData | null = await scrapeTweetMetadata(
      originalTweetUrl,
      false,
    );

    if (!origData) {
      console.log(
        `   🔞 Bài gốc bị dính nhãn 18+ (NSFW), mở qua Browser để bóc tách...`,
      );
      origData = await scrapeNSFWOriginalTweetWithBrowser(
        context,
        originalTweetUrl,
      );
    }

    if (!origData) {
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Thất bại khi lấy metadata bài gốc: ${originalTweetUrl}`,
      );
      continue;
    }

    const artistHandle = origData.handle.startsWith("@")
      ? origData.handle
      : `@${origData.handle}`;

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

    const combinedText = `${transData.text || ""} ${origData.text || ""}`;
    await autoTagPost(prisma, originalPost.id, combinedText);

    await prisma.translatedPost.create({
      data: {
        tweetId: transData.tweetId,
        tweetUrl: transData.tweetUrl,
        language: TARGET_PROFILE.language,
        content: transData.text || "",
        postedAt: new Date(transData.postedAt),
        translatorId: translator.id,
        originalPostId: originalPost.id,
      },
    });

    savedCount++;
    console.log(
      `   ✅ [${idx + 1}/${tweetIdList.length}] Lưu thành công: ${origData.name} ➔ @${TARGET_PROFILE.handle} (${tId})`,
    );

    await sleep(600);
  }

  await browser.close();

  console.log(
    `\n🏁 Hoàn tất @${TARGET_PROFILE.handle}: Đã lưu: ${savedCount} | Bỏ qua: ${skippedCount}`,
  );
}

main()
  .catch((err) => console.error("Lỗi thực thi:", err))
  .finally(async () => await prisma.$disconnect());