import { PrismaClient } from "@prisma/client";
import { scrapeTweetMetadata } from "../lib/scraper";
import { autoTagPost } from "../lib/tagger";
import { chromium, BrowserContext } from "playwright";
import * as dotenv from "dotenv";

// Import translator configurations from JSON file
import translatorsData from "../config/translators.json";

dotenv.config();

const prisma = new PrismaClient();

// 1. Target translator configurations
interface TranslatorTarget {
  name: string;
  handle: string; // Handle without the '@' prefix
  language: string; // Target language code (e.g., 'en', 'vi')
  keywords: string[]; // Keywords/hashtags to identify translation posts
  requireKeywordMatch?: boolean; // Set to false if account exclusively posts translations
}

const TARGET_TRANSLATORS: TranslatorTarget[] = translatorsData;

// Timeline query date windows
const DATE_WINDOWS = [
  // 2026
  { until: "2026-09-05", since: "2026-07-01" }, // Q3/2026 (up to current)
  { until: "2026-07-01", since: "2026-04-01" }, // Q2/2026
  { until: "2026-04-01", since: "2026-01-01" }, // Q1/2026

  // 2025
  { until: "2026-01-01", since: "2025-10-01" }, // Q4/2025
  { until: "2025-10-01", since: "2025-07-01" }, // Q3/2025
  { until: "2025-07-01", since: "2025-04-01" }, // Q2/2025
  { until: "2025-04-01", since: "2025-01-01" }, // Q1/2025

  // 2024 (Quarter-sliced)
  { until: "2025-01-01", since: "2024-10-01" }, // Q4/2024
  { until: "2024-10-01", since: "2024-07-01" }, // Q3/2024
  { until: "2024-07-01", since: "2024-04-01" }, // Q2/2024
  { until: "2024-04-01", since: "2024-01-01" }, // Q1/2024

  // 2023
  { until: "2024-01-01", since: "2023-01-01" }, // Full year 2023
];

const MAX_SCROLLS_PER_WINDOW = 100;
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

function matchesTranslationKeywords(
  text: string,
  target: TranslatorTarget,
): boolean {
  if (!target.requireKeywordMatch) return true;
  if (!text) return false;
  const lower = text.toLowerCase();
  return target.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// Scans and discovers all tweet IDs across defined date windows for a translator
async function discoverTweetIds(
  context: BrowserContext,
  target: TranslatorTarget,
): Promise<string[]> {
  const page = await context.newPage();
  const discoveredIds = new Set<string>();

  // Build query: combine keywords with OR syntax if specified
  const keywordQuery =
    target.keywords.length > 0 ? `(${target.keywords.join(" OR ")})` : "";

  for (const timeWindow of DATE_WINDOWS) {
    const query =
      `from:${target.handle} ${keywordQuery} until:${timeWindow.until} since:${timeWindow.since}`.trim();
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;

    console.log(
      `\n📅 [@${target.handle}] Window: [${timeWindow.since} -> ${timeWindow.until}]`,
    );

    try {
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(3000);

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

        const prevSize = discoveredIds.size;
        idsOnPage.forEach((id) => discoveredIds.add(id));
        const newlyFound = discoveredIds.size - prevSize;

        if (newlyFound === 0) {
          emptyScrollCount++;
          if (emptyScrollCount >= 8) {
            break;
          }
        } else {
          emptyScrollCount = 0;
          console.log(
            `   [Scroll ${scroll}/${MAX_SCROLLS_PER_WINDOW}] +${newlyFound} new tweets (Total: ${discoveredIds.size})`,
          );
        }

        await page.mouse.wheel(0, 2000);
        await page.waitForTimeout(1800);
      }
    } catch (err) {
      console.error(
        `   ⚠️ Failed loading window ${timeWindow.since} -> ${timeWindow.until}:`,
        err,
      );
    }
  }

  await page.close();
  return Array.from(discoveredIds);
}

// Scrapes and persists comic data for an individual translator
async function processTranslator(
  context: BrowserContext,
  target: TranslatorTarget,
) {
  console.log(`\n=======================================================`);
  console.log(`🚀 STARTING SCRAPER FOR: ${target.name} (@${target.handle})`);
  console.log(`=======================================================`);

  // 1. Initialize or update translator record in database
  const translatorHandleWithAt = `@${target.handle}`;
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
      profileUrl: `https://x.com/${target.handle}`,
      isTarget: true,
      filterTags: target.keywords.join(", "),
      role: "TRANSLATOR",
    },
  });

  // 2. Discover tweet IDs
  const tweetIdList = await discoverTweetIds(context, target);
  console.log(
    `\n📦 Discovered ${tweetIdList.length} tweet IDs. Parsing metadata...`,
  );

  let savedCount = 0;
  let skippedCount = 0;

  // 3. Iterate through discovered tweets
  for (let idx = 0; idx < tweetIdList.length; idx++) {
    const tId = tweetIdList[idx];

    // Idempotency check: skip already imported tweets
    const isExisted = await prisma.translatedPost.findUnique({
      where: { tweetId: tId },
      select: { id: true },
    });

    if (isExisted) {
      skippedCount++;
      continue;
    }

    const transTweetUrl = `https://x.com/${target.handle}/status/${tId}`;
    const transData = await scrapeTweetMetadata(transTweetUrl);

    if (!transData || !transData.hasMedia) {
      continue;
    }

    if (!matchesTranslationKeywords(transData.text || "", target)) {
      continue;
    }

    // Resolve original post URL: prioritize quoted tweet, fallback to embedded URLs
    let originalTweetUrl: string | undefined = transData.quotedTweetUrl;
    if (!originalTweetUrl) {
      originalTweetUrl = extractOriginalTweetUrl(transData.text || "", tId);
    }

    if (!originalTweetUrl) {
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Original tweet URL not found`,
      );
      continue;
    }

    const origData = await scrapeTweetMetadata(originalTweetUrl);
    if (!origData) {
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Failed to fetch original post data`,
      );
      continue;
    }

    const artistHandle = origData.handle.startsWith("@")
      ? origData.handle
      : `@${origData.handle}`;

    // Upsert artist record
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

    // Upsert original post record
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

    // Automatically detect and attach character tags
    const combinedText = `${transData.text || ""} ${origData.text || ""}`;
    await autoTagPost(prisma, originalPost.id, combinedText);

    // Save translated post
    await prisma.translatedPost.create({
      data: {
        tweetId: transData.tweetId,
        tweetUrl: transData.tweetUrl,
        language: target.language,
        content: transData.text || "",
        postedAt: new Date(transData.postedAt),
        translatorId: translator.id,
        originalPostId: originalPost.id,
      },
    });

    savedCount++;
    console.log(
      `   ✅ [${idx + 1}/${tweetIdList.length}] Saved: ${origData.name} ➔ @${target.handle} (${tId})`,
    );

    // Rate-limiting delay between posts
    await sleep(600);
  }

  console.log(
    `\n🏁 Finished @${target.handle}: Saved: ${savedCount} | Skipped: ${skippedCount}`,
  );
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

  for (const target of TARGET_TRANSLATORS) {
    await processTranslator(context, target);
    // Cool-down delay between accounts to prevent rate-limit flags
    console.log(`⏳ Waiting 6 seconds before processing next target...`);
    await sleep(6000);
  }

  await browser.close();
  console.log(`\n🎉 ALL TRANSLATOR TARGETS COMPLETED!`);
}

main()
  .catch((err) => console.error("Execution error:", err))
  .finally(async () => await prisma.$disconnect());
