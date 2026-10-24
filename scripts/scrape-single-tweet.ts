import { PrismaClient } from "@prisma/client";
import { scrapeTweetMetadata, TweetData } from "../lib/scraper";
import { autoTagPost } from "../lib/tagger";
import { scrapePixivMetadata, extractPixivId } from "../lib/scraper-pixiv";
import { chromium, BrowserContext, Page, Response } from "playwright";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION & BLACKLIST RULES
// ============================================================================
const DEFAULT_INPUT = "https://x.com/BlackCafe123/status/1972821181863784738";
const DEFAULT_LANGUAGE = "en";

// Hardcoded artist blacklist (works on both local dev and serverless/GitHub Actions)
const STATIC_BLACKLISTED_ARTISTS: string[] = [
  "to_zaemon",
  "toxic_artist_handle",
  "lewd_artist_example",
];

// Normalize handles: trim, remove '@', and convert to lowercase
const BLACKLISTED_ARTISTS = new Set(
  STATIC_BLACKLISTED_ARTISTS.map((h) =>
    h.replace(/^@/, "").trim().toLowerCase(),
  ).filter(Boolean),
);

function isArtistBlacklisted(identifier?: string | null): boolean {
  if (!identifier) return false;
  const clean = identifier.replace(/^@/, "").trim().toLowerCase();
  return BLACKLISTED_ARTISTS.has(clean);
}

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

// Language and non-target keywords to filter out
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

  // Other game franchises
  "fate grand order",
  "fate/grand order",
  "blue archive",
  "ブルーアーカイブ",
  "ブルアカ",
  "Kaguya",
  "gakumas",
  "arknights",
];

function isExcludedLanguage(text?: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return EXCLUDED_LANG_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

interface ExtendedTweetData extends TweetData {
  photos?: string[];
}

interface ScrapeResultSummary {
  transTweetId: string;
  translatorHandle: string;
  translatorName: string;
  artistHandle: string;
  artistName: string;
  sourceType: "PIXIV" | "TWITTER" | "UNKNOWN";
  sourceUrl: string;
  translatedImagesCount: number;
  originalPostId: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function parseValidDate(dateStr?: string, tweetId?: string): Date {
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }
  if (tweetId) {
    try {
      const epochMs = Number(
        (BigInt(tweetId) >> BigInt(22)) + BigInt("1288834974657"),
      );
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

function extractOriginalPixivUrl(text?: string | null): string | undefined {
  if (!text) return undefined;
  const match = text.match(
    /https?:\/\/(?:www\.)?pixiv\.net\/(?:en\/)?(?:artworks\/\d+|member_illust\.php\?[^\s]*illust_id=\d+|i\/\d+)/i,
  );
  return match ? match[0] : undefined;
}

async function handleUnknownOriginalPost(
  prismaClient: PrismaClient,
  transData: ExtendedTweetData,
): Promise<string> {
  const unknownArtist = await prismaClient.creator.upsert({
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
  const originalPost = await prismaClient.originalPost.upsert({
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
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } catch {
      // Ignore selector lookup timeouts
    }
  }
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
    await clickAllNSFWBypassButtons(page);

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
      timeout: 30000,
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      await clickAllNSFWBypassButtons(page);
      await page.mouse.wheel(0, 300);
      await new Promise((r) => setTimeout(r, 400));
    }

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
    console.error(`   ⚠️ NSFW browser scraping error [${tweetId}]:`, err);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

// ============================================================================
// CORE SCRAPER FUNCTION (CAN BE IMPORTED BY DISCORD BOT OR CLI)
// ============================================================================
export interface ScrapeSingleOptions {
  inputUrl: string;
  explicitOriginalUrl?: string;
  targetLanguage?: string;
  externalContext?: BrowserContext;
}

export async function scrapeSinglePost(
  options: ScrapeSingleOptions,
): Promise<ScrapeResultSummary> {
  const {
    inputUrl,
    explicitOriginalUrl,
    targetLanguage = DEFAULT_LANGUAGE,
    externalContext,
  } = options;

  const match = inputUrl.match(/\/status\/(\d+)/) || inputUrl.match(/^(\d+)$/);
  if (!match) {
    throw new Error(`Invalid tweet URL or ID: "${inputUrl}"`);
  }
  const tweetId = match[1];

  let localBrowser = null;
  let context = externalContext;

  if (!context) {
    localBrowser = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    context = await localBrowser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    if (process.env.TWITTER_AUTH_TOKEN && process.env.TWITTER_CT0) {
      for (const domain of [".x.com", ".twitter.com"]) {
        await context.addCookies([
          {
            name: "auth_token",
            value: process.env.TWITTER_AUTH_TOKEN,
            domain,
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "None",
          },
          {
            name: "ct0",
            value: process.env.TWITTER_CT0,
            domain,
            path: "/",
            secure: true,
            sameSite: "Lax",
          },
        ]);
      }
    }
  }

  try {
    const transTweetUrl = inputUrl.startsWith("http")
      ? inputUrl
      : `https://x.com/i/status/${tweetId}`;

    console.log(`\n📥 1. Fetching translation tweet: ${transTweetUrl}`);

    let transData: ExtendedTweetData | null = await scrapeTweetMetadata(
      transTweetUrl,
      false,
    );

    // Checkpoint: Excluded languages or non-target franchises
    if (transData) {
      if (
        isExcludedLanguage(transData.text || "") ||
        transData.lang === "es" ||
        transData.lang === "id"
      ) {
        throw new Error(
          `[Blocked Language] The tweet text contains excluded languages or non-Uma keywords.`,
        );
      }
    }

    // Fallback to Playwright if API scraping returned no media (NSFW)
    if (!transData || !transData.photos?.length) {
      console.log(`   🔞 Unlocking translated post images via browser...`);
      transData = await scrapeNSFWWithBrowser(context, transTweetUrl);
    }

    if (!transData) {
      throw new Error(
        `Failed to retrieve translated tweet data for ID: ${tweetId}`,
      );
    }

    if (!transData.hasMedia || !transData.photos?.length) {
      throw new Error(`The target translated tweet has no photos/media.`);
    }

    // 🌟 CHECKPOINT 1: Scan translated tweet caption for blacklisted artists
    if (transData.text && containsBlacklistedArtist(transData.text)) {
      throw new Error(
        `[Blacklist - Text] The translated tweet caption mentions a blacklisted artist.`,
      );
    }

    // Upsert Translator record
    const cleanTranslator = (transData.handle || "unknown")
      .replace(/^@/, "")
      .trim();
    const translatorHandle = `@${cleanTranslator}`;

    const translator = await prisma.creator.upsert({
      where: { handle: translatorHandle },
      update: { name: transData.name || cleanTranslator, role: "TRANSLATOR" },
      create: {
        handle: translatorHandle,
        name: transData.name || cleanTranslator,
        profileUrl: `https://x.com/${cleanTranslator}`,
        role: "TRANSLATOR",
      },
    });

    console.log(
      `   👤 Translator: ${translator.name} (${translatorHandle}) [${transData.photos.length} image(s)]`,
    );

    // ========================================================================
    // RESOLVE ORIGINAL POST (PIXIV vs TWITTER vs FALLBACK)
    // ========================================================================
    let originalPostId: string;
    let finalArtistName = "Unknown Artist";
    let finalArtistHandle = "@unknown";
    let resolvedSourceType: "PIXIV" | "TWITTER" | "UNKNOWN" = "UNKNOWN";
    let resolvedSourceUrl = "";

    // 1. Detect Pixiv URL (explicitly provided or found in translation text)
    const originalPixivUrl =
      (explicitOriginalUrl && extractPixivId(explicitOriginalUrl)
        ? explicitOriginalUrl
        : null) || extractOriginalPixivUrl(transData.text || "");

    // 2. Detect Twitter quote URL if no Pixiv link was discovered
    let originalTweetUrl: string | undefined = undefined;
    if (!originalPixivUrl) {
      originalTweetUrl =
        (explicitOriginalUrl && explicitOriginalUrl.match(/\/status\/(\d+)/)
          ? explicitOriginalUrl
          : null) ||
        transData.quotedTweetUrl ||
        extractOriginalTweetUrl(
          transData.text || "",
          tweetId,
          transData.handle,
        );

      if (!originalTweetUrl) {
        console.log(
          `   🔍 Quote not found in text, resolving via Network/DOM...`,
        );
        originalTweetUrl = await fetchOriginalTweetUrlWithNetwork(
          context,
          transTweetUrl,
          tweetId,
          transData.handle,
        );
      }
    }

    // ------------------------------------------------------------------------
    // CASE A: ORIGINAL SOURCE IS PIXIV
    // ------------------------------------------------------------------------
    if (originalPixivUrl) {
      console.log(
        `   🎨 [Pixiv Source Detected] Resolving: ${originalPixivUrl}`,
      );
      const pixivData = await scrapePixivMetadata(originalPixivUrl);

      if (!pixivData || pixivData.mediaUrls.length === 0) {
        throw new Error(`Failed to scrape Pixiv illustration metadata.`);
      }

      // Checkpoint: Pixiv artist blacklist
      if (
        isArtistBlacklisted(pixivData.artistAccount) ||
        isArtistBlacklisted(pixivData.artistName)
      ) {
        throw new Error(
          `[Blacklist - Pixiv] Artist [${pixivData.artistName} (@${pixivData.artistAccount})] is in the blacklist.`,
        );
      }

      finalArtistName = pixivData.artistName;
      finalArtistHandle = `@${pixivData.artistAccount}`;
      resolvedSourceType = "PIXIV";
      resolvedSourceUrl = originalPixivUrl;

      const artist = await prisma.creator.upsert({
        where: { handle: finalArtistHandle },
        update: {
          role: "ARTIST",
          name: pixivData.artistName,
          profileUrl: pixivData.profileUrl,
        },
        create: {
          handle: finalArtistHandle,
          name: pixivData.artistName,
          profileUrl: pixivData.profileUrl,
          role: "ARTIST",
        },
      });

      const pixivPostId = `pixiv-${pixivData.illustId}`;
      const originalPost = await prisma.originalPost.upsert({
        where: { tweetId: pixivPostId },
        update: {
          content: pixivData.title || "",
          mediaUrls: pixivData.mediaUrls,
          mediaCount: pixivData.mediaUrls.length,
          artistId: artist.id,
        },
        create: {
          tweetId: pixivPostId,
          tweetUrl: originalPixivUrl,
          postedAt: new Date(pixivData.postedAt),
          content: pixivData.title || "",
          mediaUrls: pixivData.mediaUrls,
          mediaCount: pixivData.mediaUrls.length,
          artistId: artist.id,
        },
      });

      originalPostId = originalPost.id;
      const combinedText = `${transData.text || ""} ${pixivData.title || ""} ${pixivData.caption || ""}`;
      await autoTagPost(prisma, originalPost.id, combinedText);
    }

    // ------------------------------------------------------------------------
    // CASE B: ORIGINAL SOURCE IS TWITTER / X
    // ------------------------------------------------------------------------
    else if (originalTweetUrl) {
      // 🌟 CHECKPOINT 2: Fast-check original tweet URL for blacklisted artist handle
      const urlHandleMatch = originalTweetUrl.match(
        /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status/i,
      );
      const urlHandle = urlHandleMatch ? urlHandleMatch[1].toLowerCase() : "";
      if (urlHandle && urlHandle !== "i" && isArtistBlacklisted(urlHandle)) {
        throw new Error(
          `[Blacklist - URL] Original tweet points to blacklisted artist: @${urlHandle}`,
        );
      }

      console.log(
        `   🔗 [Twitter Source Detected] Resolving: ${originalTweetUrl}`,
      );

      let origData: ExtendedTweetData | null = await scrapeTweetMetadata(
        originalTweetUrl,
        false,
      );

      if (!origData || !origData.photos?.length) {
        console.log(
          `   🔞 Original tweet is sensitive, scraping via browser...`,
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

        // 🌟 CHECKPOINT 3: Verify scraped handle and display name against blacklist
        if (
          isArtistBlacklisted(artistHandle) ||
          isArtistBlacklisted(validArtistName)
        ) {
          throw new Error(
            `[Blacklist - Artist] Original creator [${validArtistName || ""} (${artistHandle})] is blacklisted.`,
          );
        }

        finalArtistName = validArtistName || artistHandle;
        finalArtistHandle = artistHandle;
        resolvedSourceType = "TWITTER";
        resolvedSourceUrl = originalTweetUrl;

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
            mediaCount: origData.photos?.length || 0,
            artistId: artist.id,
          },
          create: {
            tweetId: origData.tweetId,
            tweetUrl: origData.tweetUrl,
            postedAt: parseValidDate(origData.postedAt, origData.tweetId),
            content: origData.text || "",
            mediaUrls: origData.photos || [],
            mediaCount: origData.photos?.length || 0,
            artistId: artist.id,
          },
        });

        originalPostId = originalPost.id;
        const combinedText = `${transData.text || ""} ${origData.text || ""}`;
        await autoTagPost(prisma, originalPost.id, combinedText);
      } else {
        // Scrape failed on quote URL -> fallback to unknown
        if (containsBlacklistedArtist(originalTweetUrl)) {
          throw new Error(
            `[Blacklist - Fallback] Original tweet link matched blacklist on failed scrape.`,
          );
        }

        console.log(
          `   ⚠️ Failed to scrape original tweet. Fallback to Unknown Artist.`,
        );
        originalPostId = await handleUnknownOriginalPost(prisma, transData);
        await autoTagPost(prisma, originalPostId, transData.text || "");
      }
    }

    // ------------------------------------------------------------------------
    // CASE C: NO ORIGINAL QUOTE OR PIXIV SOURCE FOUND
    // ------------------------------------------------------------------------
    else {
      console.log(
        `   ⚠️ Not a quote tweet and no Pixiv source found. Fallback to Unknown.`,
      );
      originalPostId = await handleUnknownOriginalPost(prisma, transData);
      await autoTagPost(prisma, originalPostId, transData.text || "");
    }

    // ========================================================================
    // UPSERT TRANSLATED POST RECORD
    // ========================================================================
    await prisma.translatedPost.upsert({
      where: { tweetId: transData.tweetId },
      update: {
        content: transData.text || "",
        mediaUrls: transData.photos || [],
        postedAt: parseValidDate(transData.postedAt, transData.tweetId),
        translatorId: translator.id,
        originalPostId,
        language: targetLanguage,
      },
      create: {
        tweetId: transData.tweetId,
        tweetUrl: transData.tweetUrl,
        language: targetLanguage,
        content: transData.text || "",
        mediaUrls: transData.photos || [],
        postedAt: parseValidDate(transData.postedAt, transData.tweetId),
        translatorId: translator.id,
        originalPostId,
      },
    });

    console.log(
      `\n✅ [Success] ${finalArtistName} (${finalArtistHandle}) ➔ ${translator.name} (${tweetId})`,
    );

    return {
      transTweetId: transData.tweetId,
      translatorHandle,
      translatorName: translator.name,
      artistHandle: finalArtistHandle,
      artistName: finalArtistName,
      sourceType: resolvedSourceType,
      sourceUrl: resolvedSourceUrl,
      translatedImagesCount: transData.photos.length,
      originalPostId,
    };
  } finally {
    if (localBrowser) {
      await localBrowser.close();
    }
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================
async function main() {
  const inputArg = (process.argv[2] || DEFAULT_INPUT).trim();
  const explicitOrig = process.argv[3]?.trim();

  console.log(`🎯 [Single Scraper CLI] Target: ${inputArg}`);
  if (explicitOrig) {
    console.log(`📌 [Explicit Source]: ${explicitOrig}`);
  }

  const result = await scrapeSinglePost({
    inputUrl: inputArg,
    explicitOriginalUrl: explicitOrig,
  });

  console.log(`\n🎉 Scraped & Synced Post ID: ${result.originalPostId}`);
}

// Execute main only when run directly from command line
if (require.main === module) {
  main()
    .catch((err) => {
      console.error(
        "\n❌ Fatal Execution Error:",
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
}
