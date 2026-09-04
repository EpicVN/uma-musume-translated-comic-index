import { PrismaClient } from "@prisma/client";
import { scrapeTweetMetadata } from "../lib/scraper";
import { autoTagPost } from "../lib/tagger";
import { chromium, BrowserContext } from "playwright";
import * as dotenv from "dotenv";

// Import translator configurations from JSON file
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

const TARGET_TRANSLATORS: TranslatorTarget[] = translatorsData;

// Current Quarter Window (from 2026-07-01 to today)
const TODAY = new Date().toISOString().split("T")[0];
const CURRENT_QUARTER_WINDOW = {
  since: "2026-07-01",
  until: TODAY,
};

const MAX_SCROLLS_QUICK_SCAN = 25; // Quick scan requires up to 25 scrolls
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

async function discoverLatestTweetIds(
  context: BrowserContext,
  target: TranslatorTarget,
): Promise<string[]> {
  const page = await context.newPage();
  const discoveredIds = new Set<string>();

  const keywordQuery =
    target.keywords.length > 0 ? `(${target.keywords.join(" OR ")})` : "";
  const query =
    `from:${target.handle} ${keywordQuery} until:${CURRENT_QUARTER_WINDOW.until} since:${CURRENT_QUARTER_WINDOW.since}`.trim();
  const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;

  console.log(
    `\n📅 [@${target.handle}] Scanning current quarter: [${CURRENT_QUARTER_WINDOW.since} -> ${CURRENT_QUARTER_WINDOW.until}]`,
  );

  try {
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2500);

    let emptyScrollCount = 0;

    for (let scroll = 1; scroll <= MAX_SCROLLS_QUICK_SCAN; scroll++) {
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
        if (emptyScrollCount >= 5) break;
      } else {
        emptyScrollCount = 0;
      }

      await page.mouse.wheel(0, 1800);
      await page.waitForTimeout(1500);
    }
  } catch (err) {
    console.error(
      `   ⚠️ Failed loading search results for @${target.handle}:`,
      err,
    );
  } finally {
    await page.close();
  }

  return Array.from(discoveredIds);
}

async function processTranslatorLatest(
  context: BrowserContext,
  target: TranslatorTarget,
) {
  console.log(`\n-------------------------------------------------------`);
  console.log(`🔍 Checking latest posts: ${target.name} (@${target.handle})`);

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

  const tweetIdList = await discoverLatestTweetIds(context, target);
  console.log(`   👉 Discovered ${tweetIdList.length} tweet IDs in quarter.`);

  let savedCount = 0;
  let skippedCount = 0;

  for (let idx = 0; idx < tweetIdList.length; idx++) {
    const tId = tweetIdList[idx];

    // Check if post already exists in DB
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

    if (
      !transData ||
      !transData.hasMedia ||
      !matchesTranslationKeywords(transData.text || "", target)
    ) {
      continue;
    }

    let originalTweetUrl: string | undefined = transData.quotedTweetUrl;
    if (!originalTweetUrl) {
      originalTweetUrl = extractOriginalTweetUrl(transData.text || "", tId);
    }

    if (!originalTweetUrl) {
      continue;
    }

    const origData = await scrapeTweetMetadata(originalTweetUrl);
    if (!origData) continue;

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
      update: { content: origData.text || "" },
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
        language: target.language,
        content: transData.text || "",
        postedAt: new Date(transData.postedAt),
        translatorId: translator.id,
        originalPostId: originalPost.id,
      },
    });

    savedCount++;
    console.log(`   ✅ [New] ${origData.name} ➔ @${target.handle} (${tId})`);
    await sleep(500);
  }

  console.log(`   📊 Summary: Saved ${savedCount} | Existing ${skippedCount}`);
}

async function runQuickUpdate() {
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

  console.log(
    `🚀 Starting quick update for current quarter across ${TARGET_TRANSLATORS.length} translators...`,
  );

  for (const target of TARGET_TRANSLATORS) {
    await processTranslatorLatest(context, target);
    await sleep(4000); // 4-second delay between translators
  }

  await browser.close();
  console.log(`\n🎉 UPDATE COMPLETE!`);
}

runQuickUpdate()
  .catch((err) => console.error("Update failed:", err))
  .finally(async () => await prisma.$disconnect());
