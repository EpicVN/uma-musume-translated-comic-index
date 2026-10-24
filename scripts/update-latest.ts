import { PrismaClient, Prisma } from "@prisma/client";
import { scrapeTweetMetadata, TweetData } from "../lib/scraper";
import { scrapePixivMetadata } from "../lib/scraper-pixiv";
import { autoTagPost } from "../lib/tagger";
import { BrowserContext, Page, Response } from "playwright";
import * as dotenv from "dotenv";

import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(stealthPlugin());

import translatorsData from "../config/translators.json";

dotenv.config();

const prisma = new PrismaClient();

interface TranslatorTarget {
  name?: string;
  handle: string;
  language: string;
  keywords: string[];
  requireKeywordMatch?: boolean;
}

interface ExtendedTweetData extends TweetData {
  photos?: string[];
}

interface ScrapedResult {
  artistName: string;
  translatorHandle: string;
  tweetId: string;
  tweetUrl: string;
  imageUrl?: string;
}

const TARGET_TRANSLATORS: TranslatorTarget[] = translatorsData;

// Calculate sliding window: from 3 days ago until tomorrow (current + 1 day)
const now = new Date();
const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
const UNTIL_DATE = tomorrow.toISOString().split("T")[0];

const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
const SINCE_DATE = threeDaysAgo.toISOString().split("T")[0];

const CURRENT_QUARTER_WINDOW = {
  since: SINCE_DATE,
  until: UNTIL_DATE,
};

// =========================================================================
// 🌟 KHU VỰC CẤU HÌNH BLACKLIST TÁC GIẢ (CHẠY TRỰC TIẾP TRÊN GITHUB ACTIONS)
// =========================================================================
const STATIC_BLACKLISTED_ARTISTS: string[] = [
  // Điền trực tiếp handle tác giả vào đây (có hoặc không có @, hoa/thường đều được)
  "to_zaemon",
];

// Chuẩn hóa toàn bộ danh sách: xóa @, trim, chuyển về chữ thường
const BLACKLISTED_ARTISTS = new Set(
  STATIC_BLACKLISTED_ARTISTS.map((h) =>
    h.replace(/^@/, "").trim().toLowerCase(),
  ).filter(Boolean),
);

// 1. Kiểm tra chính xác handle hoặc tên tác giả
function isArtistBlacklisted(identifier?: string | null): boolean {
  if (!identifier) return false;
  const clean = identifier.replace(/^@/, "").trim().toLowerCase();
  return BLACKLISTED_ARTISTS.has(clean);
}

// 2. Kiểm tra văn bản (nội dung tweet / URL) có chứa bất kỳ tác giả bị chặn nào không
function containsBlacklistedArtist(text?: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  for (const handle of BLACKLISTED_ARTISTS) {
    if (lower.includes(handle)) {
      return true;
    }
  }
  return false;
}
// =========================================================================

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function handleUnknownOriginalPost(
  prisma: PrismaClient,
  transData: ExtendedTweetData,
): Promise<string> {
  const unknownArtist = await prisma.creator.upsert({
    where: { handle: "@unknown" },
    update: {},
    create: {
      handle: "@unknown",
      name: "Unknown Artist",
      profileUrl: "https://x.com",
      role: "ARTIST",
    },
  });

  const placeholderTweetId = `unknown-${transData.tweetId}`;
  const originalPost = await prisma.originalPost.upsert({
    where: { tweetId: placeholderTweetId },
    update: {
      content: transData.text || "",
    },
    create: {
      tweetId: placeholderTweetId,
      tweetUrl: transData.tweetUrl,
      postedAt: parseValidDate(transData.postedAt, transData.tweetId),
      content: "Original post not found or not a quote tweet.",
      mediaUrls: [],
      artistId: unknownArtist.id,
    },
  });

  return originalPost.id;
}

// --- DISCORD WEBHOOK INTEGRATION ---
async function sendDiscordNotification(posts: ScrapedResult[]) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(
      " ⚠️ DISCORD_WEBHOOK_URL is not set. Skipping Discord notification.",
    );
    return;
  }

  if (posts.length === 0) return;

  try {
    const CHUNK_SIZE = 10;
    const batches: ScrapedResult[][] = [];
    for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
      batches.push(posts.slice(i, i + CHUNK_SIZE));
    }

    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index];
      const embeds = batch.map((p) => {
        const cleanImageUrl = p.imageUrl
          ? p.imageUrl.replace(/name=[a-zA-Z0-9]+/, "name=medium")
          : undefined;

        return {
          title: `${p.artistName} ➔ @${p.translatorHandle}`,
          url: p.tweetUrl,
          color: 4044018,
          image: cleanImageUrl ? { url: cleanImageUrl } : undefined,
          footer: { text: `Tweet ID: ${p.tweetId}` },
        };
      });

      const content =
        index === 0
          ? `✅ **Update Complete!** Found and saved **${posts.length}** new translated comic(s).`
          : undefined;

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, embeds }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(
          ` ❌ Discord rejected batch ${index + 1}/${batches.length} [Status ${res.status}]:`,
          errorText,
        );
      } else {
        console.log(
          ` 💬 Delivered batch ${index + 1}/${batches.length} (${batch.length} posts).`,
        );
      }

      if (index < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (err) {
    console.error(" ⚠️ Failed to execute Discord webhook fetch:", err);
  }
}

async function sendDiscordAlert(errorMessage: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🚨 **CRAWLER ALERT** 🚨\nExecution encountered an unexpected failure:\n\`\`\`${errorMessage}\`\`\``,
      }),
    });
  } catch (err) {
    console.error(" ⚠️ Failed to send Discord alert:", err);
  }
}

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

function extractOriginalPixivUrl(text: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(
    /https?:\/\/(?:www\.)?pixiv\.net\/(?:en\/)?artworks\/\d+/i,
  );
  return match ? match[0] : undefined;
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
      // Ignore background parsing errors
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

      const quoteBlock = art.querySelector(
        '[data-testid="quoteTweet"], [data-testid="tweetQuote"]',
      );
      const allUserBlocks = Array.from(
        art.querySelectorAll('[data-testid="User-Name"]'),
      );
      const userBlock =
        allUserBlocks.find((ub) => !quoteBlock || !quoteBlock.contains(ub)) ||
        allUserBlocks[0];

      const name =
        userBlock?.querySelector("span")?.textContent?.trim() || "Unknown";

      let handle = "@unknown";
      const profileLinks = Array.from(
        userBlock?.querySelectorAll('a[href^="/"]') || [],
      );
      for (const link of profileLinks) {
        const href = link.getAttribute("href") || "";
        if (!href.includes("/status") && !href.includes("/analytics")) {
          const clean = href.replace(/^\//, "").split("/")[0].split("?")[0];
          if (clean) {
            handle = `@${clean}`;
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

      const allTextEls = Array.from(
        art.querySelectorAll('[data-testid="tweetText"]'),
      );
      const mainTextEl =
        allTextEls.find((el) => !quoteBlock || !quoteBlock.contains(el)) ||
        allTextEls[0];
      const text = mainTextEl?.textContent || "";

      const timeEl = art.querySelector("time");
      const postedAt =
        timeEl?.getAttribute("datetime") ||
        document.querySelector("article time")?.getAttribute("datetime") ||
        new Date().toISOString();

      const photos: string[] = [];
      const images = Array.from(
        art.querySelectorAll('img[src*="pbs.twimg.com/media"]'),
      );
      images.forEach((img) => {
        if (quoteBlock && quoteBlock.contains(img)) return;
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

async function discoverLatestTweetIds(
  context: BrowserContext,
  target: TranslatorTarget,
): Promise<string[]> {
  const page = await context.newPage();
  const discoveredIds = new Set<string>();
  const cleanHandle = target.handle.replace(/^@/, "");

  let keywordQuery = "";
  if (
    target.requireKeywordMatch &&
    target.keywords &&
    target.keywords.length > 0
  ) {
    const formattedKeywords = target.keywords
      .map((k) => (k.includes(" ") ? `"${k}"` : k))
      .join(" OR ");
    keywordQuery = ` (${formattedKeywords})`;
  }

  const query = `(from:${cleanHandle})${keywordQuery} since:${CURRENT_QUARTER_WINDOW.since} until:${CURRENT_QUARTER_WINDOW.until}`;
  const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;

  console.log(
    `\n📅 [@${cleanHandle}] Timeline search window: [${CURRENT_QUARTER_WINDOW.since} -> ${CURRENT_QUARTER_WINDOW.until}]`,
  );
  console.log(`   🌐 Search Query URL: ${searchUrl}`);

  try {
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 35000,
    });

    await sleep(3000);

    const actualUrl = page.url();
    const actualTitle = await page.title();
    console.log(`   📍 Destination URL: ${actualUrl}`);
    console.log(`   📑 Page Title: "${actualTitle}"`);

    const tweetFound = await page
      .waitForSelector('article[data-testid="tweet"]', { timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!tweetFound) {
      console.log(
        `   ⚠️ No tweets found in the specified timeline search window for @${cleanHandle}`,
      );
      return [];
    }

    let emptyScrollCount = 0;

    for (let scroll = 1; scroll <= 10; scroll++) {
      const tweetsOnPage = await page.evaluate((targetHandle) => {
        const articles = Array.from(
          document.querySelectorAll('article[data-testid="tweet"]'),
        );
        const results: { id: string; datetime?: string; text: string }[] = [];

        articles.forEach((art) => {
          const socialContext = art.querySelector(
            '[data-testid="socialContext"]',
          );
          if (
            socialContext &&
            socialContext.textContent?.toLowerCase().includes("repost")
          ) {
            return;
          }

          const link = art.querySelector('a[href*="/status/"]');
          const timeEl = art.querySelector("time");
          const textEl = art.querySelector('[data-testid="tweetText"]');

          if (link) {
            const href = link.getAttribute("href") || "";
            const match = href.match(
              new RegExp(`^\\/${targetHandle}\\/status\\/(\\d+)`, "i"),
            );

            if (match) {
              results.push({
                id: match[1],
                datetime: timeEl?.getAttribute("datetime") || undefined,
                text: textEl?.textContent || "",
              });
            }
          }
        });
        return results;
      }, cleanHandle);

      const prevSize = discoveredIds.size;

      for (const item of tweetsOnPage) {
        const textLower = item.text.toLowerCase();
        const matchesKeyword =
          !target.requireKeywordMatch ||
          target.keywords.length === 0 ||
          target.keywords.some((kw) => textLower.includes(kw.toLowerCase()));

        if (matchesKeyword) {
          discoveredIds.add(item.id);
        }
      }

      const newlyFound = discoveredIds.size - prevSize;
      if (newlyFound === 0) {
        emptyScrollCount++;
        if (emptyScrollCount >= 3) break;
      } else {
        emptyScrollCount = 0;
      }

      await page.mouse.wheel(0, 1500);
      await sleep(1800);
    }
  } catch (err) {
    console.error(
      `   ⚠️ Failed loading search timeline for @${cleanHandle}:`,
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
): Promise<ScrapedResult[]> {
  const cleanHandle = target.handle.replace(/^@/, "");
  const translatorHandleWithAt = `@${cleanHandle}`;

  const displayName = target.name || cleanHandle;
  console.log(`\n-------------------------------------------------------`);
  console.log(
    `🔍 Checking latest posts: ${displayName} (${translatorHandleWithAt})`,
  );

  const newScrapedPosts: ScrapedResult[] = [];

  const existingTranslator = await prisma.creator.findUnique({
    where: { handle: translatorHandleWithAt },
  });

  const initialName = existingTranslator?.name || target.name || cleanHandle;

  const translator = await prisma.creator.upsert({
    where: { handle: translatorHandleWithAt },
    update: {
      isTarget: true,
      filterTags: target.keywords.join(", "),
      role: "TRANSLATOR",
    },
    create: {
      handle: translatorHandleWithAt,
      name: initialName,
      profileUrl: `https://x.com/${cleanHandle}`,
      isTarget: true,
      filterTags: target.keywords.join(", "),
      role: "TRANSLATOR",
    },
  });

  const tweetIdList = await discoverLatestTweetIds(context, target);
  console.log(`   👉 Discovered ${tweetIdList.length} tweet IDs in window.`);

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

  let skippedCount = 0;
  let hasSyncedTranslatorName = false;

  for (let idx = 0; idx < tweetIdList.length; idx++) {
    const tId = tweetIdList[idx];

    if (existingTweetIds.has(tId)) {
      console.log(
        `   ⏭️ [${idx + 1}/${tweetIdList.length}] ID ${tId} already exists in DB, skipping...`,
      );
      skippedCount++;
      continue;
    }

    const transTweetUrl = `https://x.com/${cleanHandle}/status/${tId}`;

    let transData: ExtendedTweetData | null = await scrapeTweetMetadata(
      transTweetUrl,
      false,
    );

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

    // 🌟 CHỐT CHẶN 1: Quét thẳng text của bài dịch (nếu dịch giả ghi Art: @blacklisted)
    if (transData.text && containsBlacklistedArtist(transData.text)) {
      console.log(
        `   ⛔ [Blacklist - Text] ID ${tId}: Mentioned a blacklisted artist in text. Skipping...`,
      );
      skippedCount++;
      continue;
    }

    const authorHandle = (transData.handle || "")
      .replace(/^@/, "")
      .trim()
      .toLowerCase();

    if (authorHandle && authorHandle !== cleanHandle.toLowerCase()) {
      console.log(
        `   ⏭️ [Skip Repost] ID ${tId} is authored by @${authorHandle}, not @${cleanHandle}. Skipping...`,
      );
      skippedCount++;
      continue;
    }

    const cleanScrapedHandle = (transData.handle || "")
      .replace(/^@/, "")
      .toLowerCase();
    const isTargetHandle = cleanScrapedHandle === cleanHandle.toLowerCase();

    if (
      !hasSyncedTranslatorName &&
      isTargetHandle &&
      transData.name &&
      transData.name !== "Unknown" &&
      transData.name !== "Unknown Artist" &&
      transData.name !== "Unknown Translator"
    ) {
      const cleanName = transData.name.trim();
      if (cleanName && cleanName !== translator.name) {
        await prisma.creator.update({
          where: { id: translator.id },
          data: { name: cleanName },
        });
        console.log(
          `   🔄 Synced new X display name: "${translator.name}" ➔ "${cleanName}"`,
        );
        translator.name = cleanName;
      }
      hasSyncedTranslatorName = true;
    }

    // --- TÌM LINK BÀI GỐC CỦA ARTIST ---
    // --- TÌM LINK BÀI GỐC CỦA ARTIST (ƯU TIÊN PIXIV NẾU CÓ) ---
    const originalPixivUrl: string | undefined = extractOriginalPixivUrl(
      transData.text || "",
    );

    let originalTweetUrl: string | undefined = transData.quotedTweetUrl;

    // Nếu không có link Pixiv trong text, tìm link Twitter
    if (!originalPixivUrl) {
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

      // 🌟 CHỐT CHẶN: Quét URL bài gốc Twitter (loại trừ trường hợp x.com/i/status/...)
      if (originalTweetUrl) {
        const urlHandleMatch = originalTweetUrl.match(
          /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status/i,
        );
        const urlHandle = urlHandleMatch ? urlHandleMatch[1].toLowerCase() : "";

        if (urlHandle && urlHandle !== "i" && isArtistBlacklisted(urlHandle)) {
          console.log(
            `   ⛔ [Blacklist - URL] ID ${tId} points to blacklisted artist: @${urlHandle}. Skipping...`,
          );
          skippedCount++;
          continue;
        }
      }
    }

    let originalPostId: string;
    let fallbackArtistName = "Unknown Artist";

    // ==============================================================
    // TRƯỜNG HỢP 1: BÀI GỐC LÀ LINK PIXIV
    // ==============================================================
    if (originalPixivUrl) {
      console.log(
        `   🎨 [Pixiv Source] ID ${tId}: Tìm thấy link gốc Pixiv ➔ ${originalPixivUrl}`,
      );
      const pixivData = await scrapePixivMetadata(originalPixivUrl);

      if (pixivData) {
        // 🌟 Chốt chặn Blacklist tác giả Pixiv (quét cả handle tài khoản và tên hiển thị)
        if (
          isArtistBlacklisted(pixivData.artistAccount) ||
          isArtistBlacklisted(pixivData.artistName)
        ) {
          console.log(
            `   ⛔ [Blacklist - Pixiv] Tác giả Pixiv [${pixivData.artistName} (@${pixivData.artistAccount})] nằm trong blacklist. Bỏ qua...`,
          );
          skippedCount++;
          continue;
        }

        fallbackArtistName = pixivData.artistName;
        const artistHandle = `@${pixivData.artistAccount}`;

        // 1. Tạo hoặc cập nhật tác giả Pixiv
        const artist = await prisma.creator.upsert({
          where: { handle: artistHandle },
          update: {
            role: "ARTIST",
            name: pixivData.artistName,
            profileUrl: pixivData.profileUrl,
          },
          create: {
            handle: artistHandle,
            name: pixivData.artistName,
            profileUrl: pixivData.profileUrl,
            role: "ARTIST",
          },
        });

        // 2. Lưu bài gốc Pixiv với tiền tố "pixiv-" để tránh đụng độ ID số với Twitter
        const pixivPostId = `pixiv-${pixivData.illustId}`;
        const originalPost = await prisma.originalPost.upsert({
          where: { tweetId: pixivPostId },
          update: {
            content: pixivData.title || "",
            mediaUrls: pixivData.mediaUrls || [],
            artistId: artist.id,
          },
          create: {
            tweetId: pixivPostId,
            tweetUrl: originalPixivUrl,
            postedAt: new Date(pixivData.postedAt),
            content: pixivData.title || "",
            mediaUrls: pixivData.mediaUrls || [],
            artistId: artist.id,
          },
        });

        originalPostId = originalPost.id;

        // 3. Tự động gắn tag nhân vật (kết hợp tiêu đề Pixiv + text bài dịch)
        const combinedText = `${transData.text || ""} ${pixivData.title || ""} ${pixivData.caption || ""}`;
        await autoTagPost(prisma, originalPost.id, combinedText);
      } else {
        // Cào Pixiv thất bại -> Kiểm tra lại URL trước khi fallback sang Unknown
        if (containsBlacklistedArtist(originalPixivUrl)) {
          console.log(
            `   ⛔ [Blacklist - Pixiv Fail] Link Pixiv nằm trong blacklist. Bỏ qua...`,
          );
          skippedCount++;
          continue;
        }

        console.log(
          `   ⚠️ Không cào được dữ liệu Pixiv, chuyển sang gán Unknown Artist.`,
        );
        originalPostId = await handleUnknownOriginalPost(prisma, transData);
        await autoTagPost(prisma, originalPostId, transData.text || "");
      }
    }

    // ==============================================================
    // TRƯỜNG HỢP 2: BÀI GỐC LÀ LINK TWITTER / X
    // ==============================================================
    else if (originalTweetUrl) {
      let origData: ExtendedTweetData | null = await scrapeTweetMetadata(
        originalTweetUrl,
        false,
      );

      if (!origData || !origData.photos?.length) {
        console.log(
          `   🔞 Scraping original tweet photos via browser (NSFW)...`,
        );
        origData = await scrapeNSFWWithBrowser(context, originalTweetUrl);
      }

      if (origData) {
        const artistHandle = origData.handle.startsWith("@")
          ? origData.handle
          : `@${origData.handle}`;

        const validArtistName =
          origData.name &&
          origData.name !== "Unknown" &&
          origData.name !== "Unknown Artist"
            ? origData.name.trim()
            : undefined;

        // 🌟 Chốt chặn Blacklist tác giả Twitter
        if (
          isArtistBlacklisted(artistHandle) ||
          isArtistBlacklisted(validArtistName)
        ) {
          console.log(
            `   ⛔ [Blacklist - Artist] ID ${tId}: Original creator [${validArtistName || ""} (${artistHandle})] is blacklisted. Skipping...`,
          );
          skippedCount++;
          continue;
        }

        fallbackArtistName = validArtistName || artistHandle;

        const artist = await prisma.creator.upsert({
          where: { handle: artistHandle },
          update: {
            role: "ARTIST",
            ...(validArtistName ? { name: validArtistName } : {}),
          },
          create: {
            handle: artistHandle,
            name: validArtistName || artistHandle,
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

        originalPostId = originalPost.id;
        const combinedText = `${transData.text || ""} ${origData.text || ""}`;
        await autoTagPost(prisma, originalPost.id, combinedText);
      } else {
        if (containsBlacklistedArtist(originalTweetUrl)) {
          console.log(
            `   ⛔ [Blacklist - Fallback] Original tweet link matched blacklist on failed scrape. Skipping...`,
          );
          skippedCount++;
          continue;
        }

        originalPostId = await handleUnknownOriginalPost(prisma, transData);
        await autoTagPost(prisma, originalPostId, transData.text || "");
      }
    }

    // ==============================================================
    // TRƯỜNG HỢP 3: KHÔNG TÌM THẤY BẤT KỲ LINK GỐC NÀO
    // ==============================================================
    else {
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Not a quote tweet and no Pixiv source. Fallback to Unknown Artist.`,
      );
      originalPostId = await handleUnknownOriginalPost(prisma, transData);
      await autoTagPost(prisma, originalPostId, transData.text || "");
    }

    // NẾU TÌM THẤY BÀI GỐC -> TIẾN HÀNH CÀO
    if (originalTweetUrl) {
      let origData: ExtendedTweetData | null = await scrapeTweetMetadata(
        originalTweetUrl,
        false,
      );

      if (!origData || !origData.photos?.length) {
        console.log(
          `   🔞 Scraping original tweet photos via browser (NSFW)...`,
        );
        origData = await scrapeNSFWWithBrowser(context, originalTweetUrl);
      }

      if (origData) {
        const artistHandle = origData.handle.startsWith("@")
          ? origData.handle
          : `@${origData.handle}`;

        const validArtistName =
          origData.name &&
          origData.name !== "Unknown" &&
          origData.name !== "Unknown Artist"
            ? origData.name.trim()
            : undefined;

        // 🌟 CHỐT CHẶN 3: Quét handle và display name thực tế cào được
        if (
          isArtistBlacklisted(artistHandle) ||
          isArtistBlacklisted(validArtistName)
        ) {
          console.log(
            `   ⛔ [Blacklist - Artist] ID ${tId}: Original creator [${validArtistName || ""} (${artistHandle})] is blacklisted. Skipping...`,
          );
          skippedCount++;
          continue;
        }

        fallbackArtistName = validArtistName || artistHandle;

        const artist = await prisma.creator.upsert({
          where: { handle: artistHandle },
          update: {
            role: "ARTIST",
            ...(validArtistName ? { name: validArtistName } : {}),
          },
          create: {
            handle: artistHandle,
            name: validArtistName || artistHandle,
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

        originalPostId = originalPost.id;
        const combinedText = `${transData.text || ""} ${origData.text || ""}`;
        await autoTagPost(prisma, originalPost.id, combinedText);
      } else {
        // 🌟 CHỐT CHẶN 4: Có link nhưng cào lỗi -> kiểm tra lại link trước khi fallback sang Unknown
        if (containsBlacklistedArtist(originalTweetUrl)) {
          console.log(
            `   ⛔ [Blacklist - Fallback] Original tweet link matched blacklist on failed scrape. Skipping...`,
          );
          skippedCount++;
          continue;
        }

        originalPostId = await handleUnknownOriginalPost(prisma, transData);
      }
    } else {
      // 🌟 KHÔNG PHẢI QUOTE / KHÔNG TÌM THẤY TWEET GỐC -> GÁN UNKNOWN
      console.log(
        `   ⚠️ [${idx + 1}/${tweetIdList.length}] ID ${tId}: Not a quote tweet. Fallback to Unknown Artist.`,
      );
      originalPostId = await handleUnknownOriginalPost(prisma, transData);
      await autoTagPost(prisma, originalPostId, transData.text || "");
    }

    // LƯU BÀI DỊCH BÌNH THƯỜNG VÀO DATABASE
    await prisma.translatedPost.upsert({
      where: { tweetId: transData.tweetId },
      update: {
        content: transData.text || "",
        mediaUrls: transData.photos || [],
        postedAt: parseValidDate(transData.postedAt, transData.tweetId),
        translatorId: translator.id,
        originalPostId: originalPostId,
      },
      create: {
        tweetId: transData.tweetId,
        tweetUrl: transData.tweetUrl,
        language: target.language,
        content: transData.text || "",
        mediaUrls: transData.photos || [],
        postedAt: parseValidDate(transData.postedAt, transData.tweetId),
        translatorId: translator.id,
        originalPostId: originalPostId,
      },
    });

    newScrapedPosts.push({
      artistName: fallbackArtistName,
      translatorHandle: cleanHandle,
      tweetId: transData.tweetId,
      tweetUrl: transData.tweetUrl,
      imageUrl: transData.photos?.[0],
    });

    const isUnknown = fallbackArtistName === "Unknown Artist";
    const artistDisplay = isUnknown ? "❓ Unknown Artist" : fallbackArtistName;
    const sourceStatus = isUnknown ? " [No Quote/Fallback]" : "";

    console.log(
      `   ✅ [New] ${artistDisplay} ➔ @${cleanHandle} (${tId}) [${transData.photos?.length || 0} images]${sourceStatus}`,
    );

    await sleep(200);
  }

  console.log(
    `   📊 Summary: Saved ${newScrapedPosts.length} | Existing/Skipped ${skippedCount}`,
  );

  return newScrapedPosts;
}

async function runQuickUpdate() {
  console.log("🔍 Environment Check:");
  console.log(
    " - DATABASE_URL:",
    process.env.DATABASE_URL ? "Loaded" : "MISSING",
  );
  console.log(
    " - TWITTER_AUTH_TOKEN:",
    process.env.TWITTER_AUTH_TOKEN ? "Loaded" : "MISSING",
  );
  console.log(
    " - TWITTER_CT0:",
    process.env.TWITTER_CT0 ? "Loaded" : "MISSING",
  );
  console.log(
    " - DISCORD_WEBHOOK_URL:",
    process.env.DISCORD_WEBHOOK_URL ? "Loaded" : "MISSING",
  );

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    locale: "en-US",
    timezoneId: "Asia/Ho_Chi_Minh",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });

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
    const domains = [".x.com", ".twitter.com"];
    for (const domain of domains) {
      await context.addCookies([
        {
          name: "auth_token",
          value: process.env.TWITTER_AUTH_TOKEN,
          domain: domain,
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "None",
        },
        {
          name: "ct0",
          value: process.env.TWITTER_CT0,
          domain: domain,
          path: "/",
          secure: true,
          sameSite: "Lax",
        },
      ]);
    }
  }

  console.log(
    `🚀 Starting quick update across ${TARGET_TRANSLATORS.length} translators...`,
  );

  let totalNewPosts: ScrapedResult[] = [];

  for (const target of TARGET_TRANSLATORS) {
    const results = await processTranslatorLatest(context, target);
    totalNewPosts = totalNewPosts.concat(results);

    console.log(`⏳ Cooldown for 3 seconds before next translator...`);
    await sleep(3000);
  }

  await browser.close();

  if (totalNewPosts.length > 0) {
    await sendDiscordNotification(totalNewPosts);
  }

  console.log(`\n🎉 UPDATE COMPLETE! Total new posts: ${totalNewPosts.length}`);
}

runQuickUpdate()
  .catch(async (err) => {
    console.error("Update failed:", err);
    await sendDiscordAlert(err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
