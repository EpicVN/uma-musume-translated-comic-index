// lib/scrape-single-api.ts
import { PrismaClient } from "@prisma/client";
import { scrapeTweetData } from "@/lib/api-twitter-scraper";
import { scrapePixivMetadata, extractPixivId } from "@/lib/scraper-pixiv";
import { autoTagPost } from "@/lib/tagger";

// Prisma singleton instance
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// BLACKLIST & EXCLUSION RULES
// ============================================================================
const STATIC_BLACKLISTED_ARTISTS: string[] = [
  "to_zaemon",
  "toxic_artist_handle",
];

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

const EXCLUDED_LANG_KEYWORDS = [
  "traducción al español",
  "traduccion al español",
  "español",
  "espanol",
  "spanish",
  "terjemahan indonesia",
  "bahasa indonesia",
  "indonesian",
  "fate grand order",
  "blue archive",
  "ブルアカ",
];

function isExcludedLanguage(text?: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return EXCLUDED_LANG_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function extractOriginalPixivUrl(text?: string | null): string | undefined {
  if (!text) return undefined;
  const match = text.match(
    /https?:\/\/(?:www\.)?pixiv\.net\/(?:en\/)?(?:artworks\/\d+|member_illust\.php\?[^\s]*illust_id=\d+|i\/\d+)/i,
  );
  return match ? match[0] : undefined;
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

export interface ScrapeSingleOptions {
  inputUrl: string;
  explicitOriginalUrl?: string;
  targetLanguage?: string;
}

export interface ScrapeResultSummary {
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
// CORE SERVERLESS-SAFE SCRAPER (No Playwright dependency)
// ============================================================================
export async function scrapeSinglePost(
  options: ScrapeSingleOptions,
): Promise<ScrapeResultSummary> {
  const { inputUrl, explicitOriginalUrl, targetLanguage = "en" } = options;

  const match = inputUrl.match(/\/status\/(\d+)/) || inputUrl.match(/^(\d+)$/);
  if (!match) {
    throw new Error(`Invalid tweet URL or ID: "${inputUrl}"`);
  }
  const transTweetId = match[1];
  const transTweetUrl = inputUrl.startsWith("http")
    ? inputUrl
    : `https://x.com/i/status/${transTweetId}`;

  // 1. Scrape translated post via lightweight API
  const transData = await scrapeTweetData(transTweetUrl);
  if (!transData || !transData.mediaUrls?.length) {
    throw new Error(`Failed to scrape translated tweet or post has no images.`);
  }

  // 2. Language & Blacklist checks
  if (isExcludedLanguage(transData.text || "")) {
    throw new Error(
      `[Blocked Language] Caption contains excluded non-Uma language keywords.`,
    );
  }

  if (transData.text && containsBlacklistedArtist(transData.text)) {
    throw new Error(
      `[Blacklist - Text] Translated caption mentions a blacklisted artist.`,
    );
  }

  // 3. Upsert Translator record
  const cleanTranslator = (transData.artistHandle || "unknown")
    .replace(/^@/, "")
    .trim();
  const translatorHandle = `@${cleanTranslator}`;

  const translator = await prisma.creator.upsert({
    where: { handle: translatorHandle },
    update: {
      name: transData.artistName || cleanTranslator,
      role: "TRANSLATOR",
    },
    create: {
      handle: translatorHandle,
      name: transData.artistName || cleanTranslator,
      profileUrl: `https://x.com/${cleanTranslator}`,
      role: "TRANSLATOR",
    },
  });

  // 4. Resolve Original Source (Pixiv vs Twitter vs Fallback)
  let originalPostId: string;
  let finalArtistName = "Unknown Artist";
  let finalArtistHandle = "@unknown";
  let resolvedSourceType: "PIXIV" | "TWITTER" | "UNKNOWN" = "UNKNOWN";
  let resolvedSourceUrl = "";

  const originalPixivUrl =
    (explicitOriginalUrl && extractPixivId(explicitOriginalUrl)
      ? explicitOriginalUrl
      : null) || extractOriginalPixivUrl(transData.text || "");

  let originalTweetUrl: string | undefined = undefined;
  if (!originalPixivUrl) {
    originalTweetUrl =
      (explicitOriginalUrl && explicitOriginalUrl.match(/\/status\/(\d+)/)
        ? explicitOriginalUrl
        : null) ||
      extractOriginalTweetUrl(
        transData.text || "",
        transTweetId,
        transData.artistHandle,
      );
  }

  // --- CASE A: PIXIV SOURCE ---
  if (originalPixivUrl) {
    const pixivData = await scrapePixivMetadata(originalPixivUrl);
    if (!pixivData || pixivData.mediaUrls.length === 0) {
      throw new Error(`Failed to fetch Pixiv illustration metadata.`);
    }

    if (
      isArtistBlacklisted(pixivData.artistAccount) ||
      isArtistBlacklisted(pixivData.artistName)
    ) {
      throw new Error(
        `[Blacklist - Pixiv] Artist [${pixivData.artistName}] is blacklisted.`,
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

    const pixivUniqueId = `pixiv-${pixivData.illustId}`;
    const origPost = await prisma.originalPost.upsert({
      where: { tweetId: pixivUniqueId },
      update: {
        content: pixivData.title || "",
        mediaUrls: pixivData.mediaUrls,
        mediaCount: pixivData.mediaUrls.length,
        artistId: artist.id,
      },
      create: {
        tweetId: pixivUniqueId,
        tweetUrl: originalPixivUrl,
        postedAt: new Date(pixivData.postedAt),
        content: pixivData.title || "",
        mediaUrls: pixivData.mediaUrls,
        mediaCount: pixivData.mediaUrls.length,
        artistId: artist.id,
      },
    });

    originalPostId = origPost.id;
    const combinedText = `${transData.text || ""} ${pixivData.title || ""} ${pixivData.caption || ""}`;
    await autoTagPost(prisma, origPost.id, combinedText);
  }

  // --- CASE B: TWITTER SOURCE ---
  else if (originalTweetUrl) {
    const urlHandleMatch = originalTweetUrl.match(
      /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status/i,
    );
    const urlHandle = urlHandleMatch ? urlHandleMatch[1].toLowerCase() : "";
    if (urlHandle && urlHandle !== "i" && isArtistBlacklisted(urlHandle)) {
      throw new Error(
        `[Blacklist - URL] Quote URL points to blacklisted artist: @${urlHandle}`,
      );
    }

    // 🌟 Bóc tách tweetId từ originalTweetUrl
    const origTweetMatch = originalTweetUrl.match(/\/status\/(\d+)/);
    const origTweetId = origTweetMatch ? origTweetMatch[1] : null;

    if (!origTweetId) {
      throw new Error(`Invalid original tweet URL format: ${originalTweetUrl}`);
    }

    const canonicalOrigTweetUrl = `https://x.com/i/status/${origTweetId}`;
    const origData = await scrapeTweetData(originalTweetUrl);

    if (origData && origData.mediaUrls.length > 0) {
      const artistHandle = origData.artistHandle?.startsWith("@")
        ? origData.artistHandle
        : `@${origData.artistHandle || "unknown"}`;

      if (
        isArtistBlacklisted(artistHandle) ||
        isArtistBlacklisted(origData.artistName)
      ) {
        throw new Error(
          `[Blacklist - Artist] Original creator [${artistHandle}] is blacklisted.`,
        );
      }

      finalArtistName = origData.artistName || artistHandle;
      finalArtistHandle = artistHandle;
      resolvedSourceType = "TWITTER";
      resolvedSourceUrl = canonicalOrigTweetUrl;

      const artist = await prisma.creator.upsert({
        where: { handle: artistHandle },
        update: {
          role: "ARTIST",
          name: finalArtistName,
          profileUrl: `https://x.com/${artistHandle.replace("@", "")}`,
        },
        create: {
          handle: artistHandle,
          name: finalArtistName,
          profileUrl: `https://x.com/${artistHandle.replace("@", "")}`,
          role: "ARTIST",
        },
      });

      // 🌟 Dùng origTweetId và canonicalOrigTweetUrl thay cho origData.tweetId / origData.tweetUrl
      const origPost = await prisma.originalPost.upsert({
        where: { tweetId: origTweetId },
        update: {
          content: origData.text || "",
          mediaUrls: origData.mediaUrls,
          mediaCount: origData.mediaUrls.length,
          artistId: artist.id,
        },
        create: {
          tweetId: origTweetId,
          tweetUrl: canonicalOrigTweetUrl,
          postedAt: origData.postedAt
            ? new Date(origData.postedAt)
            : new Date(),
          content: origData.text || "",
          mediaUrls: origData.mediaUrls,
          mediaCount: origData.mediaUrls.length,
          artistId: artist.id,
        },
      });

      originalPostId = origPost.id;
      const combinedText = `${transData.text || ""} ${origData.text || ""}`;
      await autoTagPost(prisma, origPost.id, combinedText);
    } else {
      // Fallback unknown
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

      const origPost = await prisma.originalPost.upsert({
        where: { tweetId: `unknown-${transTweetId}` },
        update: { content: transData.text || "" },
        create: {
          tweetId: `unknown-${transTweetId}`,
          tweetUrl: transTweetUrl,
          postedAt: transData.postedAt
            ? new Date(transData.postedAt)
            : new Date(), // 👈 Thêm dòng này
          content: "Original post not found or unlinked.",
          mediaUrls: [],
          artistId: unknownArtist.id,
        },
      });

      originalPostId = origPost.id;
      await autoTagPost(prisma, origPost.id, transData.text || "");
    }
  }

  // --- CASE C: NO SOURCE FOUND ---
  else {
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

    const origPost = await prisma.originalPost.upsert({
      where: { tweetId: `unknown-${transTweetId}` },
      update: { content: transData.text || "" },
      create: {
        tweetId: `unknown-${transTweetId}`,
        tweetUrl: transTweetUrl,
        postedAt: transData.postedAt
          ? new Date(transData.postedAt)
          : new Date(), // 👈 Thêm dòng này
        content: "Original post not found or unlinked.",
        mediaUrls: [],
        artistId: unknownArtist.id,
      },
    });

    originalPostId = origPost.id;
    await autoTagPost(prisma, origPost.id, transData.text || "");
  }

  // 5. Upsert TranslatedPost
  await prisma.translatedPost.upsert({
    where: { tweetId: transTweetId },
    update: {
      content: transData.text || "",
      mediaUrls: transData.mediaUrls,
      translatorId: translator.id,
      originalPostId,
      language: targetLanguage,
    },
    create: {
      tweetId: transTweetId,
      tweetUrl: transTweetUrl,
      language: targetLanguage,
      content: transData.text || "",
      mediaUrls: transData.mediaUrls,
      translatorId: translator.id,
      originalPostId,
      postedAt: transData.postedAt ? new Date(transData.postedAt) : new Date(),
    },
  });

  return {
    transTweetId,
    translatorHandle,
    translatorName: translator.name,
    artistHandle: finalArtistHandle,
    artistName: finalArtistName,
    sourceType: resolvedSourceType,
    sourceUrl: resolvedSourceUrl,
    translatedImagesCount: transData.mediaUrls.length,
    originalPostId,
  };
}
