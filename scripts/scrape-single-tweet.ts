import { PrismaClient } from "@prisma/client";
import { scrapeTweetMetadata, TweetData } from "../lib/scraper";
import { autoTagPost } from "../lib/tagger";
import { chromium, BrowserContext, Response } from "playwright";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// ============================================================================
// DEFAULT CONFIGURATION (Used when no CLI argument is provided)
// ============================================================================
const DEFAULT_INPUT = "https://x.com/BlackCafe123/status/1972821181863784738";
const TARGET_LANGUAGE = "en";

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
      // Ignore if tweetId is not a valid snowflake numeric sequence
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

interface ExtendedTweetData extends TweetData {
  photos?: string[];
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

// Retrieve original post URL via GraphQL network response or DOM quote cards
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
        (url.includes("TweetDetail") || url.includes("TweetResultByRestId"))
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
            return;
          }
        }
      }
    } catch {
      // Ignore background network parse errors
    }
  };

  page.on("response", responseHandler);

  try {
    await page.goto(transTweetUrl, {
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
      await page.waitForTimeout(1500);
    }

    if (!originalUrl) {
      originalUrl = await page.evaluate(
        ({ currId, transHandle }) => {
          const quoteContainers = document.querySelectorAll(
            'div[aria-labelledby*="id__"], div[tabindex="0"][role="link"], article[data-testid="tweet"] div[role="link"]',
          );
          for (const container of Array.from(quoteContainers)) {
            const links = Array.from(
              container.querySelectorAll('a[href*="/status/"]'),
            );
            for (const link of links) {
              const href = link.getAttribute("href") || "";
              const match = href.match(
                /(?:twitter\.com|x\.com)?\/([a-zA-Z0-9_]+)\/status\/(\d+)/i,
              );
              if (
                match &&
                match[2] !== currId &&
                match[1].toLowerCase() !== transHandle
              ) {
                return `https://x.com/${match[1]}/status/${match[2]}`;
              }
            }
          }

          const allLinks = Array.from(
            document.querySelectorAll(
              'article[data-testid="tweet"] a[href*="/status/"]',
            ),
          );
          for (const link of allLinks) {
            const href = link.getAttribute("href") || "";
            const match = href.match(
              /(?:twitter\.com|x\.com)?\/([a-zA-Z0-9_]+)\/status\/(\d+)/i,
            );
            if (
              match &&
              match[2] !== currId &&
              match[1].toLowerCase() !== transHandle
            ) {
              return `https://x.com/${match[1]}/status/${match[2]}`;
            }
          }

          return undefined;
        },
        { currId: currentTweetId, transHandle: cleanTranslator },
      );
    }
  } catch (err) {
    console.error(`   ⚠️ Failed to scan for original post link:`, err);
  } finally {
    page.off("response", responseHandler);
    await page.close().catch(() => {});
  }

  return originalUrl;
}

// Scrape metadata and image links directly via Playwright browser (bypass 18+/NSFW warnings)
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
      timeout: 35000,
    });
    await page.waitForTimeout(2500);

    // Bypass age gate/sensitive content dialogs if present
    const viewButtons = page.locator(
      'button:has-text("View"), button:has-text("Show"), div[role="button"]:has-text("View")',
    );
    const btnCount = await viewButtons.count();
    for (let i = 0; i < btnCount; i++) {
      await viewButtons
        .nth(i)
        .click()
        .catch(() => {});
      await page.waitForTimeout(600);
    }

    await page
      .waitForSelector('article[data-testid="tweet"]', { timeout: 10000 })
      .catch(() => {});

    const data = await page.evaluate((id) => {
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
    console.error(`   ⚠️ NSFW browser scraping error [${tweetId}]:`, err);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const inputArg = (process.argv[2] || DEFAULT_INPUT).trim();

  // Extract valid Tweet ID: match digits after /status/ or exact numeric strings
  const match = inputArg.match(/\/status\/(\d+)/) || inputArg.match(/^(\d+)$/);

  if (!match) {
    console.error("❌ Invalid tweet URL or Tweet ID:", inputArg);
    return;
  }

  const tweetId = match[1];
  console.log(`🎯 Processing Tweet ID: ${tweetId}`);

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
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
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

  // Preserve provided input URL to prevent redirection issues on x.com/i/status/...
  const transTweetUrl = inputArg.startsWith("http")
    ? inputArg
    : `https://x.com/i/status/${tweetId}`;
  console.log(`📥 1. Fetching translated tweet details: ${transTweetUrl}`);

  let transData: ExtendedTweetData | null = await scrapeTweetMetadata(
    transTweetUrl,
    true,
  );

  if (!transData || !transData.photos?.length) {
    console.log(`   🔞 Scraping translated tweet via browser fallback...`);
    transData = await scrapeNSFWWithBrowser(context, transTweetUrl);
  }

  if (!transData) {
    console.error(
      `❌ Failed to retrieve translated tweet data for ID: ${tweetId}`,
    );
    await browser.close();
    return;
  }

  console.log(`   Translator: ${transData.name} (${transData.handle})`);
  console.log(
    `   Images found in translated post: ${transData.photos?.length || 0}`,
  );

  const translatorHandle = transData.handle.startsWith("@")
    ? transData.handle
    : `@${transData.handle}`;
  const translator = await prisma.creator.upsert({
    where: { handle: translatorHandle },
    update: { name: transData.name, role: "TRANSLATOR" },
    create: {
      handle: translatorHandle,
      name: transData.name,
      profileUrl: `https://x.com/${translatorHandle.replace("@", "")}`,
      role: "TRANSLATOR",
    },
  });

  let originalTweetUrl = transData.quotedTweetUrl;
  if (!originalTweetUrl) {
    originalTweetUrl = extractOriginalTweetUrl(
      transData.text || "",
      tweetId,
      transData.handle,
    );
  }

  if (!originalTweetUrl) {
    console.log(`🔍 2. Resolving original quote link via Network/DOM...`);
    originalTweetUrl = await fetchOriginalTweetUrlWithNetwork(
      context,
      transTweetUrl,
      tweetId,
      transData.handle,
    );
  }

  if (!originalTweetUrl) {
    console.error(`❌ Original artist tweet URL not found`);
    await browser.close();
    return;
  }

  console.log(`🔗 Original post URL: ${originalTweetUrl}`);

  let origData: ExtendedTweetData | null = await scrapeTweetMetadata(
    originalTweetUrl,
    false,
  );
  if (!origData || !origData.photos?.length) {
    console.log(
      `   🔞 Original tweet flagged as NSFW, extracting via browser...`,
    );
    origData = await scrapeNSFWWithBrowser(context, originalTweetUrl);
  }

  if (!origData) {
    console.error(`❌ Failed to retrieve original post data`);
    await browser.close();
    return;
  }

  console.log(`   Artist: ${origData.name} (${origData.handle})`);
  console.log(
    `   Images found in original post: ${origData.photos?.length || 0}`,
  );

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
      language: TARGET_LANGUAGE,
      content: transData.text || "",
      mediaUrls: transData.photos || [],
      postedAt: parseValidDate(transData.postedAt, transData.tweetId),
      translatorId: translator.id,
      originalPostId: originalPost.id,
    },
  });

  console.log(
    `\n🎉 COMPLETED: Recorded ${origData.name} (${origData.handle}) ➔ ${transData.name} (${tweetId})`,
  );
  await browser.close();
}

main()
  .catch((err) => console.error("Error:", err))
  .finally(async () => await prisma.$disconnect());
