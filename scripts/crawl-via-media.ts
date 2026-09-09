import { PrismaClient } from "@prisma/client";
import { scrapeTweetMetadata, TweetData } from "../lib/scraper";
import { autoTagPost } from "../lib/tagger";
import { chromium, BrowserContext, Response } from "playwright";
import * as dotenv from "dotenv";
import translatorsData from "../config/translators.json";

dotenv.config();

const prisma = new PrismaClient();

export interface TranslatorConfig {
  name: string;
  handle: string; // Handle without @
  language?: string;
  keywords?: string[];
  requireKeywordMatch?: boolean;
}

interface ExtendedTweetData extends TweetData {
  photos?: string[];
}

const TRANSLATORS_LIST: TranslatorConfig[] =
  translatorsData as TranslatorConfig[];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safely parses date strings; falls back to extracting timestamp
 * from Twitter Snowflake ID if the date string is invalid.
 */
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
      // Ignore if tweetId cannot be converted to a BigInt snowflake
    }
  }
  return new Date();
}

/**
 * Extracts original tweet URL mentioned inside text body,
 * skipping current tweet ID and translator handle self-references.
 */
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

/**
 * Validates if tweet content matches keyword filtering constraints.
 */
function matchesTranslationKeywords(
  text: string,
  profile: TranslatorConfig,
): boolean {
  if (!profile.requireKeywordMatch) return true;
  if (!text) return false;
  if (!profile.keywords || profile.keywords.length === 0) return true;

  const lower = text.toLowerCase();
  return profile.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

interface QuotedResultContainer {
  quoted_status_result?: {
    result?: Record<string, unknown>;
  };
}

/**
 * Recursively locates the quoted tweet object inside Twitter GraphQL response JSON.
 */
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

/**
 * Inspects GraphQL network traffic and DOM quote elements to retrieve
 * the original tweet URL when Twitter hides quoted tweets behind NSFW warning flags.
 */
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
      // Ignore background network parsing errors
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
    console.error(
      `   ⚠️ Failed to discover original tweet URL via DOM/Network:`,
      err,
    );
  } finally {
    page.off("response", responseHandler);
    await page.close().catch(() => {});
  }

  return originalUrl;
}

/**
 * Headless browser scraper that bypasses NSFW warning dialogs and
 * extracts direct high-resolution image links (`name=orig`).
 */
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
    console.error(
      `   ⚠️ Failed to scrape NSFW post via browser [${tweetId}]:`,
      err,
    );
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Navigates to user's /media tab, switches filter to Photos, and scrolls to discover tweet IDs.
 */
async function discoverTweetIdsFromProfile(
  context: BrowserContext,
  handle: string,
): Promise<string[]> {
  const page = await context.newPage();
  const discoveredIds = new Set<string>();
  const cleanHandle = handle.replace(/^@/, "");

  const profileMediaUrl = `https://x.com/${cleanHandle}/media`;
  console.log(`\n🔍 Opening Media Tab: ${profileMediaUrl}`);

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
      // Ignore background network parse errors
    }
  };

  page.on("response", responseHandler);

  try {
    await page.goto(profileMediaUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    const retryBtn = page
      .locator('button:has-text("Retry"), div[role="button"]:has-text("Retry")')
      .first();
    if (await retryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`⚠️ Detected retry prompt, reloading page...`);
      await retryBtn.click();
      await page.waitForTimeout(3500);
    }

    // Switch to Photos filter
    try {
      const filterDropdown = page
        .locator(
          'nav[role="navigation"] div[role="tab"][aria-selected="true"], nav[role="navigation"] [role="tab"]:has-text("Photos"), nav[role="navigation"] [role="tab"]:has-text("Videos"), nav[role="navigation"] [role="tab"]:has-text("All")',
        )
        .first();

      if (
        await filterDropdown.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        const currentLabel = (await filterDropdown.textContent()) || "";

        if (!currentLabel.trim().startsWith("Photos")) {
          console.log(
            `🔄 Current tab is "${currentLabel.trim()}", switching to "Photos"...`,
          );
          await filterDropdown.click();
          await page.waitForTimeout(1000);

          const photosOption = page
            .locator(
              '[role="menu"] [role="menuitem"]:has-text("Photos"), [data-testid="Dropdown"] div:has-text("Photos"), div[role="button"]:has-text("Photos")',
            )
            .first();

          if (
            await photosOption.isVisible({ timeout: 2500 }).catch(() => false)
          ) {
            await photosOption.click();
            console.log(`✅ Selected Photos filter successfully.`);
            await page.waitForTimeout(2500);
          } else {
            await page.keyboard.press("Escape");
          }
        } else {
          console.log(`✅ Current tab is already set to Photos.`);
        }
      }
    } catch (filterErr) {
      console.log(
        `⚠️ Unable to manipulate dropdown menu, continuing with default tab:`,
        filterErr,
      );
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
          const match = href.match(/\/status\/(\d+)/);
          if (match) ids.push(match[1]);
        });
        return ids;
      }, cleanHandle.toLowerCase());

      idsOnPage.forEach((id) => discoveredIds.add(id));
      const newlyFound = discoveredIds.size - lastSize;

      if (newlyFound === 0) {
        emptyScrollCount++;

        if (await retryBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`⚠️ Detected retry button while scrolling, retrying...`);
          await retryBtn.click();
          await page.waitForTimeout(3000);
          continue;
        }

        await page.mouse.wheel(0, -600);
        await page.waitForTimeout(600);
        await page.mouse.wheel(0, 3500);

        if (emptyScrollCount >= 15) {
          console.log(
            `🛑 No new tweets detected after 15 attempts. End of Media Timeline.`,
          );
          break;
        }
      } else {
        emptyScrollCount = 0;
        lastSize = discoveredIds.size;
        console.log(
          `   [Scroll #${scrollCount}] +${newlyFound} new IDs | Total: ${discoveredIds.size} tweets`,
        );
      }

      // Memory optimization: clear DOM nodes periodically
      if (scrollCount % 40 === 0) {
        await page.evaluate(() => {
          const articles = document.querySelectorAll(
            'article[data-testid="tweet"]',
          );
          for (let i = 0; i < articles.length - 15; i++) {
            articles[i].remove();
          }
        });
      }

      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(1600);
    }
  } catch (err) {
    console.error(
      `⚠️ Error scrolling media timeline for @${cleanHandle}:`,
      err,
    );
  } finally {
    page.off("response", responseHandler);
    await page.close().catch(() => {});
  }

  return Array.from(discoveredIds);
}

/**
 * Processes scraping, quote tweet resolution, image saving, and auto-tagging for a single translator profile.
 */
async function processTranslator(
  context: BrowserContext,
  profile: TranslatorConfig,
) {
  const cleanHandle = profile.handle.replace(/^@/, "");
  const translatorHandle = `@${cleanHandle}`;
  const keywordsStr = profile.keywords?.join(", ") || "";

  console.log(`\n=======================================================`);
  console.log(`🚀 PROFILE SCRAPER: ${profile.name} (${translatorHandle})`);
  console.log(`=======================================================`);

  const translator = await prisma.creator.upsert({
    where: { handle: translatorHandle },
    update: {
      name: profile.name,
      isTarget: true,
      filterTags: keywordsStr,
      role: "TRANSLATOR",
    },
    create: {
      handle: translatorHandle,
      name: profile.name,
      profileUrl: `https://x.com/${cleanHandle}`,
      isTarget: true,
      filterTags: keywordsStr,
      role: "TRANSLATOR",
    },
  });

  const tweetIdList = await discoverTweetIdsFromProfile(context, cleanHandle);
  console.log(
    `\n📦 Extracted ${tweetIdList.length} tweet IDs from @${cleanHandle}. Processing records...`,
  );

  let savedCount = 0;
  let skippedCount = 0;

  for (let idx = 0; idx < tweetIdList.length; idx++) {
    const tId = tweetIdList[idx];

    // Skip if already in database with complete mediaUrls array
    const existedPost = await prisma.translatedPost.findUnique({
      where: { tweetId: tId },
      select: { id: true, mediaUrls: true },
    });

    if (existedPost && existedPost.mediaUrls.length > 0) {
      skippedCount++;
      continue;
    }

    const transTweetUrl = `https://x.com/${cleanHandle}/status/${tId}`;
    let transData: ExtendedTweetData | null = await scrapeTweetMetadata(
      transTweetUrl,
      true,
    );

    // Fallback: Browser scraping if syndication fails or lacks images (e.g. NSFW flagged)
    if (!transData || !transData.photos?.length) {
      transData = await scrapeNSFWWithBrowser(context, transTweetUrl);
    }

    if (!transData || !transData.hasMedia) {
      continue;
    }

    if (!matchesTranslationKeywords(transData.text || "", profile)) {
      continue;
    }

    let originalTweetUrl: string | undefined = transData.quotedTweetUrl;

    if (!originalTweetUrl) {
      originalTweetUrl = extractOriginalTweetUrl(
        transData.text || "",
        tId,
        profile.handle,
      );
    }

    if (!originalTweetUrl) {
      console.log(
        `   🔍 [${idx + 1}/${tweetIdList.length}] Quoted post hidden behind warning, resolving via Network/DOM...`,
      );
      originalTweetUrl = await fetchOriginalTweetUrlWithNetwork(
        context,
        transTweetUrl,
        tId,
        profile.handle,
      );
    }

    if (!originalTweetUrl) {
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Original artist tweet URL not found`,
      );
      continue;
    }

    let origData: ExtendedTweetData | null = await scrapeTweetMetadata(
      originalTweetUrl,
      false,
    );

    // Fallback: Browser scraping for raw artist post if sensitive
    if (!origData || !origData.photos?.length) {
      console.log(
        `   🔞 Original tweet flagged as NSFW, extracting images via browser...`,
      );
      origData = await scrapeNSFWWithBrowser(context, originalTweetUrl);
    }

    if (!origData) {
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Failed to extract original post metadata: ${originalTweetUrl}`,
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
        language: profile.language || "en",
        content: transData.text || "",
        mediaUrls: transData.photos || [],
        postedAt: parseValidDate(transData.postedAt, transData.tweetId),
        translatorId: translator.id,
        originalPostId: originalPost.id,
      },
    });

    savedCount++;
    console.log(
      `   ✅ [${idx + 1}/${tweetIdList.length}] Saved: ${origData.name} ➔ @${cleanHandle} (${tId}) [${transData.photos?.length || 0} images]`,
    );

    await sleep(600);
  }

  console.log(
    `\n🏁 Finished @${cleanHandle}: Saved: ${savedCount} | Skipped: ${skippedCount}`,
  );
}

async function main() {
  console.log(
    `Loaded ${TRANSLATORS_LIST.length} translators from translators.json`,
  );

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

  for (let i = 0; i < TRANSLATORS_LIST.length; i++) {
    const profile = TRANSLATORS_LIST[i];
    console.log(
      `\n▶️ [${i + 1}/${TRANSLATORS_LIST.length}] Crawling profile @${profile.handle}...`,
    );
    try {
      await processTranslator(context, profile);
    } catch (profileErr) {
      console.error(
        `❌ Error crawling profile @${profile.handle}:`,
        profileErr,
      );
    }
    await sleep(3000);
  }

  await browser.close();
  console.log(`\n🎉 COMPLETED CRAWLING ALL TARGET TRANSLATOR PROFILES!`);
}

main()
  .catch((err) => console.error("Execution error:", err))
  .finally(async () => await prisma.$disconnect());
