import { PrismaClient } from "@prisma/client";
import { scrapeTweetMetadata, TweetData } from "../lib/scraper";
import { autoTagPost } from "../lib/tagger";
import { chromium, BrowserContext, Page, Response } from "playwright";
import * as dotenv from "dotenv";

import translatorsData from "../config/translators.json";

dotenv.config();

const prisma = new PrismaClient();

interface TranslatorTarget {
  name: string;
  handle: string;
  language: string;
  keywords: string[];
  requireKeywordMatch?: boolean;
}

interface ExtendedTweetData extends TweetData {
  photos?: string[];
}

const TARGET_TRANSLATORS: TranslatorTarget[] = translatorsData;

const DATE_WINDOWS = [
  // // 2026
  { until: "2026-10-01", since: "2026-07-01" },
  { until: "2026-07-01", since: "2026-04-01" },
  { until: "2026-04-01", since: "2026-01-01" },

  // 2025
  { until: "2026-01-01", since: "2025-10-01" },
  { until: "2025-10-01", since: "2025-07-01" },
  { until: "2025-07-01", since: "2025-04-01" },
  { until: "2025-04-01", since: "2025-01-01" },

  // 2024
  { until: "2025-01-01", since: "2024-10-01" },
  { until: "2024-10-01", since: "2024-07-01" },
  { until: "2024-07-01", since: "2024-04-01" },
  { until: "2024-04-01", since: "2024-01-01" },

  // 2023
  { until: "2024-01-01", since: "2023-01-01" },
];

const EXCLUDED_LANG_KEYWORDS = [
  "traducción al español",
  "traduccion al español",
  "traducción al espanol",
  "traduccion al espanol",
  "traducción",
  "traduccion",
  "español",
  "espanol",
  "spanish",
  "スペイン訳版",
  "スペイン訳",
  "indonesian translation",
  "indonesian trans",
  "terjemahan indonesia",
  "terjemahan bahasa",
  "terjemahan",
  "bahasa indonesia",
  "bahasa",
  "indonesia",
  "indonesian",
  "インドネシア語翻訳",
  "インドネシア語訳",
  "インドネシア訳",
  "インドネシア語",
  "tradução",
  "traducao",
  "português",
  "portugues",
  "traduction",

  // Other games
  "fate grand order",
  "fate/grand order",
  "blue archive",
  "ブルーアーカイブ",
  "ブルアカ",
  "Kaguya",
  "gakumas",
  "arknights",
];

const MAX_SCROLLS_PER_WINDOW = 100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseValidDate(dateStr?: string, tweetId?: string): Date {
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }
  if (tweetId) {
    try {
      const epochMs = Number((BigInt(tweetId) >> 22n) + 1288834974657n);
      const d = new Date(epochMs);
      if (!isNaN(d.getTime())) return d;
    } catch {
      // Ignore conversion error
    }
  }
  return new Date();
}

function extractOriginalTweetUrl(
  text: string,
  currentTweetId: string,
  translatorHandle: string,
): string | undefined {
  if (!text) return undefined;
  const cleanTranslator = translatorHandle.replace(/^@/, "").toLowerCase();
  const matches = text.matchAll(
    /https?:\/\/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/gi,
  );
  for (const match of matches) {
    const handle = match[1].toLowerCase();
    const tweetId = match[2];
    if (tweetId !== currentTweetId && handle !== cleanTranslator) {
      return match[0];
    }
  }
  return undefined;
}

function isExcludedLanguage(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return EXCLUDED_LANG_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function matchesTranslationKeywords(
  text: string,
  target: TranslatorTarget,
): boolean {
  if (!target.requireKeywordMatch) return true;
  if (!text) return false;
  const lower = text.toLowerCase();
  return target.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

interface QuotedResultContainer {
  quoted_status_result?: {
    result?: Record<string, unknown>;
  };
}

const findQuotedRecursive = (obj: unknown): Record<string, unknown> | null => {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown> & QuotedResultContainer;
  if (record.quoted_status_result?.result) {
    return record.quoted_status_result.result;
  }
  for (const key of Object.keys(record)) {
    const res = findQuotedRecursive(record[key]);
    if (res) return res;
  }
  return null;
};

async function clickAllNSFWBypassButtons(page: Page): Promise<void> {
  const nsfwSelectors = [
    'button:has-text("Show")',
    'button:has-text("View")',
    'button:has-text("Xem")',
    'div[role="button"]:has-text("Show")',
    'div[role="button"]:has-text("View")',
    'div[role="button"]:has-text("Xem")',
    '[data-testid="empty_state_button_text"]',
    'div[data-testid="tweet"] div[role="button"]:has(span)',
    'div[aria-label*="sensitive" i]',
    'div[aria-label*="warning" i]',
  ];

  for (const sel of nsfwSelectors) {
    try {
      const elements = page.locator(sel);
      const count = await elements.count();
      for (let i = 0; i < count; i++) {
        const el = elements.nth(i);
        if (await el.isVisible().catch(() => false)) {
          await el.click({ force: true, timeout: 1500 }).catch(() => {});
          await sleep(250);
        }
      }
    } catch {
      // Ignore selector errors
    }
  }

  await page
    .evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll('div[role="button"], button'),
      );
      for (const b of buttons) {
        const txt = (b.textContent || "").trim().toLowerCase();
        if (
          txt === "show" ||
          txt === "view" ||
          txt === "xem" ||
          txt.includes("show content") ||
          txt.includes("view content") ||
          txt.includes("hiển thị")
        ) {
          (b as HTMLElement).click();
        }
      }
    })
    .catch(() => {});
}

async function fetchOriginalTweetUrlWithNetwork(
  context: BrowserContext,
  transTweetUrl: string,
  currentTweetId: string,
  translatorHandle: string,
): Promise<string | undefined> {
  const page = await context.newPage();
  let originalUrl: string | undefined = undefined;
  const cleanTranslator = translatorHandle.replace(/^@/, "").toLowerCase();

  const responseHandler = async (response: Response) => {
    try {
      const url = response.url();
      if (
        url.includes("/graphql/") &&
        (url.includes("Tweet") || url.includes("Status"))
      ) {
        const json: unknown = await response.json();
        const quotedResult = findQuotedRecursive(json);

        if (quotedResult) {
          const targetTweet = (quotedResult.tweet || quotedResult) as Record<
            string,
            unknown
          >;
          const restId =
            typeof targetTweet.rest_id === "string"
              ? targetTweet.rest_id
              : undefined;
          const coreResults = targetTweet.core as
            | Record<string, unknown>
            | undefined;
          const userResults = coreResults?.user_results as
            | Record<string, unknown>
            | undefined;
          const userResult = userResults?.result as
            | Record<string, unknown>
            | undefined;
          const legacy = userResult?.legacy as
            | Record<string, unknown>
            | undefined;
          const authorHandle = (legacy?.screen_name ||
            (userResult?.core as Record<string, unknown> | undefined)
              ?.screen_name) as string | undefined;

          if (
            restId &&
            restId !== currentTweetId &&
            authorHandle?.toLowerCase() !== cleanTranslator
          ) {
            const finalHandle = authorHandle || "i";
            originalUrl = `https://x.com/${finalHandle}/status/${restId}`;
          }
        }
      }
    } catch {
      // Ignore background parse error
    }
  };

  page.on("response", responseHandler);

  try {
    await page.goto(transTweetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });

    for (let loop = 0; loop < 3; loop++) {
      await clickAllNSFWBypassButtons(page);
      await page.mouse.wheel(0, 400);
      await sleep(400);
    }

    let waitLoops = 0;
    while (!originalUrl && waitLoops < 8) {
      await sleep(250);
      waitLoops++;
    }

    if (!originalUrl) {
      originalUrl = await page.evaluate(
        ({ currId, transHandle }) => {
          const quoteContainers = document.querySelectorAll(
            '[data-testid="quoteTweet"], [data-testid="tweetQuote"], div[aria-labelledby*="id__"][role="link"], div[tabindex="0"][role="link"]',
          );

          for (const box of Array.from(quoteContainers)) {
            const links = Array.from(
              box.querySelectorAll('a[href*="/status/"]'),
            );
            for (const a of links) {
              const href = a.getAttribute("href") || "";
              const m = href.match(
                /(?:twitter\.com|x\.com)?\/([a-zA-Z0-9_]+)\/status\/(\d+)/i,
              );
              if (m && m[2] !== currId && m[1].toLowerCase() !== transHandle) {
                return `https://x.com/${m[1]}/status/${m[2]}`;
              }
            }
          }

          const allLinks = Array.from(
            document.querySelectorAll(
              'article[data-testid="tweet"] a[href*="/status/"]',
            ),
          );
          for (const a of allLinks) {
            const href = a.getAttribute("href") || "";
            const m = href.match(
              /(?:twitter\.com|x\.com)?\/([a-zA-Z0-9_]+)\/status\/(\d+)/i,
            );
            if (m && m[2] !== currId && m[1].toLowerCase() !== transHandle) {
              return `https://x.com/${m[1]}/status/${m[2]}`;
            }
          }

          return undefined;
        },
        { currId: currentTweetId, transHandle: cleanTranslator },
      );
    }
  } catch (err) {
    console.error(
      `   ⚠️ Failed to discover original tweet URL via browser:`,
      err,
    );
  } finally {
    page.off("response", responseHandler);
    await page.close().catch(() => {});
  }

  return originalUrl;
}

async function scrapeNSFWWithBrowser(
  context: BrowserContext,
  tweetUrl: string,
): Promise<ExtendedTweetData | null> {
  const match = tweetUrl.match(/\/status\/(\d+)/) || tweetUrl.match(/^(\d+)$/);
  if (!match) return null;
  const tweetId = match[1];

  const page = await context.newPage();

  try {
    await page.goto(tweetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });

    await page
      .waitForSelector('article[data-testid="tweet"]', { timeout: 8000 })
      .catch(() => {});

    for (let attempt = 0; attempt < 3; attempt++) {
      await clickAllNSFWBypassButtons(page);
      await page.mouse.wheel(0, 300);
      await sleep(400);

      const hasImages = await page
        .locator('article[data-testid="tweet"] img[src*="pbs.twimg.com/media"]')
        .count();
      if (hasImages > 0) {
        break;
      }
    }

    await page.waitForTimeout(600);

    const data = await page.evaluate((id) => {
      const art = document.querySelector('article[data-testid="tweet"]');
      if (!art) return null;

      const userBlock = art.querySelector('[data-testid="User-Name"]');
      const name =
        userBlock?.querySelector("span")?.textContent || "Unknown Artist";

      let handle = "@unknown";
      const profileLinks = Array.from(
        userBlock?.querySelectorAll('a[href^="/"]') || [],
      );
      for (const link of profileLinks) {
        const href = link.getAttribute("href") || "";
        if (!href.includes("/status") && !href.includes("/analytics")) {
          const cleanHandle = href
            .replace(/^\//, "")
            .split("/")[0]
            .split("?")[0];
          if (cleanHandle) {
            handle = `@${cleanHandle}`;
            break;
          }
        }
      }

      if (handle === "@unknown") {
        const spans = Array.from(userBlock?.querySelectorAll("span") || []);
        const handleSpan = spans.find((s) =>
          s.textContent?.trim().startsWith("@"),
        );
        if (handleSpan && handleSpan.textContent) {
          handle = handleSpan.textContent.trim();
        }
      }

      const textEl = art.querySelector('[data-testid="tweetText"]');
      const text = textEl?.textContent || "";

      const timeEl = art.querySelector("time");
      const postedAt =
        timeEl?.getAttribute("datetime") ||
        document.querySelector("article time")?.getAttribute("datetime") ||
        new Date().toISOString();

      const photos: string[] = [];
      art.querySelectorAll('img[src*="pbs.twimg.com/media"]').forEach((img) => {
        const src = img.getAttribute("src");
        if (src) {
          const highRes = src.replace(/name=[a-zA-Z0-9]+/, "name=orig");
          if (!photos.includes(highRes)) {
            photos.push(highRes);
          }
        }
      });

      return {
        tweetId: id,
        tweetUrl: window.location.href,
        name,
        handle,
        postedAt,
        text,
        hasMedia: photos.length > 0,
        photos,
      };
    }, tweetId);

    return data;
  } catch (err) {
    console.error(
      `   ⚠️ Failed to scrape NSFW content via Browser [${tweetId}]:`,
      err,
    );
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

async function discoverTweetIds(
  context: BrowserContext,
  target: TranslatorTarget,
): Promise<string[]> {
  const page = await context.newPage();
  const discoveredIds = new Set<string>();

  const keywordQuery =
    target.keywords.length > 0 ? `(${target.keywords.join(" OR ")})` : "";

  for (const timeWindow of DATE_WINDOWS) {
    const query =
      `from:${target.handle} ${keywordQuery} until:${timeWindow.until} since:${timeWindow.since}`.trim();

    const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query`;

    console.log(
      `\n📅 [@${target.handle}] Window: [${timeWindow.since} -> ${timeWindow.until}]`,
    );

    try {
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 35000,
      });

      // Đợi bài viết đầu tiên xuất hiện để đảm bảo timeline đã tải xong
      await page
        .waitForSelector('article[data-testid="tweet"]', { timeout: 10000 })
        .catch(() => {});
      await sleep(3500);

      const retryBtn = page
        .locator(
          'button:has-text("Retry"), div[role="button"]:has-text("Retry")',
        )
        .first();

      if (await retryBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await retryBtn.click();
        await sleep(3000);
        await page
          .waitForSelector('article[data-testid="tweet"]', { timeout: 8000 })
          .catch(() => {});
      }

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
              const match = href.match(/\/status\/(\d+)/);
              if (match) ids.push(match[1]);
            }
          });
          return ids;
        });

        const prevSize = discoveredIds.size;
        idsOnPage.forEach((id) => discoveredIds.add(id));
        const newlyFound = discoveredIds.size - prevSize;

        if (newlyFound === 0) {
          emptyScrollCount++;
          if (emptyScrollCount >= 4) {
            break;
          }
        } else {
          emptyScrollCount = 0;
          console.log(
            `   [Scroll ${scroll}/${MAX_SCROLLS_PER_WINDOW}] +${newlyFound} new tweets (Total: ${discoveredIds.size})`,
          );
        }

        await page.mouse.wheel(0, 2500);
        await sleep(2000);
      }
    } catch (err) {
      console.error(
        `   ⚠️ Error accessing time window [${timeWindow.since} -> ${timeWindow.until}]:`,
        err,
      );
    }
  }

  await page.close();
  return Array.from(discoveredIds);
}

async function processTranslator(
  context: BrowserContext,
  target: TranslatorTarget,
) {
  console.log(`\n=======================================================`);
  console.log(`🚀 STARTING CRAWL: ${target.name} (@${target.handle})`);
  console.log(`=======================================================`);

  const translatorHandleWithAt = `@${target.handle.replace(/^@/, "")}`;
  const translator = await prisma.creator.upsert({
    where: { handle: translatorHandleWithAt },
    update: {
      name: target.name,
      isTarget: true,
      filterTags: target.keywords.join(", "),
      role: "TRANSLATOR",
    },
    create: {
      handle: translatorHandleWithAt,
      name: target.name,
      profileUrl: `https://x.com/${target.handle.replace(/^@/, "")}`,
      isTarget: true,
      filterTags: target.keywords.join(", "),
      role: "TRANSLATOR",
    },
  });

  const tweetIdList = await discoverTweetIds(context, target);
  console.log(
    `\n📦 Discovered ${tweetIdList.length} tweet IDs. Checking existing posts in DB...`,
  );

  // 1. TRUY VẤN 1 LẦN TẤT CẢ CÁC TWEET ĐÃ TỒN TẠI VÀ ĐỦ MEDIA TRONG DATABASE
  const existingRecords = await prisma.translatedPost.findMany({
    where: {
      tweetId: { in: tweetIdList },
    },
    select: { tweetId: true, mediaUrls: true },
  });

  const existingTweetIds = new Set(
    existingRecords
      .filter((post) => post.mediaUrls && post.mediaUrls.length > 0)
      .map((post) => post.tweetId),
  );

  let savedCount = 0;
  let skippedCount = 0;

  for (let idx = 0; idx < tweetIdList.length; idx++) {
    const tId = tweetIdList[idx];

    // 2. KIỂM TRA TỨC THÌ (IN-MEMORY) VÀ LOG RÕ RÀNG
    if (existingTweetIds.has(tId)) {
      console.log(
        `   ⏭️ [${idx + 1}/${tweetIdList.length}] ID ${tId} already exists in DB, skipping...`,
      );
      skippedCount++;
      continue;
    }

    const transTweetUrl = `https://x.com/${target.handle.replace(/^@/, "")}/status/${tId}`;

    let transData: ExtendedTweetData | null = await scrapeTweetMetadata(
      transTweetUrl,
      false,
    );

    // ========================================================================
    // BƯỚC 1: KIỂM TRA TỪ KHÓA CẤM
    // ========================================================================
    if (transData) {
      if (
        isExcludedLanguage(transData.text || "") ||
        transData.lang === "es" ||
        transData.lang === "id"
      ) {
        console.log(
          `   🚫 [Skip Excluded Lang] ID ${tId}: Blocked keyword/language detected.`,
        );
        skippedCount++;
        continue;
      }

      if (!matchesTranslationKeywords(transData.text || "", target)) {
        skippedCount++;
        continue;
      }
    }

    // ========================================================================
    // BƯỚC 2: MỞ BROWSER NẾU DÍNH CỜ 18+ (KHÔNG LẤY ĐƯỢC METADATA / THIẾU ẢNH)
    // ========================================================================
    if (!transData || !transData.photos?.length) {
      console.log(
        `   🔞 [NSFW Detected] ID ${tId}: Unlocking content via browser...`,
      );
      transData = await scrapeNSFWWithBrowser(context, transTweetUrl);

      if (!transData) {
        skippedCount++;
        continue;
      }

      if (
        isExcludedLanguage(transData.text || "") ||
        !matchesTranslationKeywords(transData.text || "", target)
      ) {
        console.log(`   🚫 [Skip Excluded Lang (Browser)] ID ${tId}`);
        skippedCount++;
        continue;
      }
    }

    if (!transData.hasMedia || !transData.photos?.length) {
      continue;
    }

    // ========================================================================
    // BƯỚC 3: TÌM BÀI VIẾT GỐC CỦA ARTIST
    // ========================================================================
    let originalTweetUrl: string | undefined = transData.quotedTweetUrl;

    if (!originalTweetUrl) {
      originalTweetUrl = extractOriginalTweetUrl(
        transData.text || "",
        tId,
        target.handle,
      );
    }

    if (!originalTweetUrl) {
      console.log(
        `   🔍 [${idx + 1}/${tweetIdList.length}] Original quote not found in text, resolving via Network/DOM...`,
      );
      originalTweetUrl = await fetchOriginalTweetUrlWithNetwork(
        context,
        transTweetUrl,
        tId,
        target.handle,
      );
    }

    if (!originalTweetUrl) {
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Original artist tweet URL not found`,
      );
      continue;
    }

    // ========================================================================
    // BƯỚC 4: BÓC TÁCH BÀI GỐC CỦA ARTIST
    // ========================================================================
    let origData: ExtendedTweetData | null = await scrapeTweetMetadata(
      originalTweetUrl,
      false,
    );

    if (!origData || !origData.photos?.length) {
      console.log(`   🔞 Scraping original tweet photos via browser (NSFW)...`);
      origData = await scrapeNSFWWithBrowser(context, originalTweetUrl);
    }

    if (!origData) {
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Failed to extract original post metadata`,
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
        mediaUrls: origData.photos || [],
        artistId: artist.id,
      },
      create: {
        tweetId: origData.tweetId,
        tweetUrl: origData.tweetUrl,
        postedAt: parseValidDate(origData.postedAt, origData.tweetId),
        content: origData.text || "",
        mediaUrls: origData.photos || [],
        artistId: artist.id,
      },
    });

    const combinedText = `${transData.text || ""} ${origData.text || ""}`;
    await autoTagPost(prisma, originalPost.id, combinedText);

    await prisma.translatedPost.upsert({
      where: { tweetId: transData.tweetId },
      update: {
        content: transData.text || "",
        mediaUrls: transData.photos || [],
        postedAt: parseValidDate(transData.postedAt, transData.tweetId),
        originalPostId: originalPost.id,
      },
      create: {
        tweetId: transData.tweetId,
        tweetUrl: transData.tweetUrl,
        language: target.language,
        content: transData.text || "",
        mediaUrls: transData.photos || [],
        postedAt: parseValidDate(transData.postedAt, transData.tweetId),
        translatorId: translator.id,
        originalPostId: originalPost.id,
      },
    });

    savedCount++;
    console.log(
      `   ✅ [${idx + 1}/${tweetIdList.length}] Saved: ${origData.name} ➔ @${target.handle} (${tId}) [${transData.photos?.length || 0} images]`,
    );

    await sleep(200);
  }

  console.log(
    `\n🏁 Finished @${target.handle}: Saved: ${savedCount} | Skipped: ${skippedCount}`,
  );
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });

  // Chặn font, analytics, video stream nhưng GIỮ LẠI toàn bộ ảnh pbs.twimg.com
  await context.route("**/*", (route) => {
    const resourceType = route.request().resourceType();
    const url = route.request().url();

    if (
      resourceType === "font" ||
      url.includes("google-analytics") ||
      url.includes("analytics") ||
      url.includes("video.twimg.com") ||
      url.includes("/video.")
    ) {
      return route.abort();
    }
    return route.continue();
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

  for (const target of TARGET_TRANSLATORS) {
    await processTranslator(context, target);
    console.log(`⏳ Cooldown for 3 seconds before next translator...`);
    await sleep(3000);
  }

  await browser.close();
  console.log(`\n🎉 COMPLETED CRAWLING ALL TARGET TRANSLATORS!`);
}

main()
  .catch((err) => console.error("Execution error:", err))
  .finally(async () => await prisma.$disconnect());
