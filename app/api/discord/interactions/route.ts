import { NextRequest, NextResponse } from "next/server";
import {
  verifyKey,
  InteractionType,
  InteractionResponseType,
} from "discord-interactions";
import { PrismaClient, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { scrapeTweetData } from "@/lib/api-twitter-scraper";
import { scrapePixivMetadata, extractPixivId } from "@/lib/scraper-pixiv";
import { waitUntil } from "@vercel/functions";

// Cấu hình thời gian chạy tối đa cho tác vụ cào ảnh ngầm trên Vercel
export const maxDuration = 60;

// Khởi tạo Prisma Client Singleton tránh cạn connection trên Serverless
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

interface RevalidateOptions {
  postId?: string;
  originalPostId?: string;
  artistHandle?: string;
  characterSlugs?: string[];
}

export function revalidateComicUpdates(options: RevalidateOptions) {
  try {
    revalidatePath("/", "page");

    if (options.postId) {
      revalidatePath(`/post/${options.postId}`, "page");
    }

    if (options.originalPostId && options.originalPostId !== options.postId) {
      revalidatePath(`/post/${options.originalPostId}`, "page");
    }

    if (options.artistHandle) {
      const handle = encodeURIComponent(options.artistHandle.trim());
      revalidatePath(`/artist/${handle}`, "page");
      revalidatePath(`/creator/${handle}`, "page");
    }

    if (options.characterSlugs && options.characterSlugs.length > 0) {
      revalidatePath("/characters", "page");

      const uniqueSlugs = new Set(
        options.characterSlugs.map((s) => s?.trim()).filter(Boolean),
      );

      for (const slug of uniqueSlugs) {
        revalidatePath(`/character/${slug}`, "page");
        revalidatePath(`/tag/${slug}`, "page");
      }
    }
  } catch (error) {
    console.error("Failed to revalidate paths:", error);
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatFriendlyError(err: unknown): {
  reason: string;
  suggestion: string;
} {
  const message = err instanceof Error ? err.message : String(err);

  if (
    message.includes("tweetId") &&
    (message.includes("Unique constraint") ||
      message.includes("already exists"))
  ) {
    return {
      reason:
        "This Twitter or Pixiv link is already assigned to another comic post.",
      suggestion:
        "Please check if this post already exists, or click **Reject** if the reporter submitted the wrong link.",
    };
  }

  if (message.includes("No images found")) {
    return {
      reason: "The provided link does not contain any readable images.",
      suggestion:
        "Please check if the link points to a private post, text-only tweet, or incorrect URL.",
    };
  }

  if (message.includes("Pixiv illustration")) {
    return {
      reason: "Failed to fetch artwork from Pixiv (deleted, private, or R-18).",
      suggestion:
        "Ensure the Pixiv illust ID is valid and accessible publicly without login.",
    };
  }

  if (
    message.includes("Missing tweet URL") ||
    message.includes("Missing source URL")
  ) {
    return {
      reason: "No valid Twitter or Pixiv link was provided to process.",
      suggestion:
        "Please reject this report and ask the reporter to include a valid link.",
    };
  }

  if (message.includes("Translated comic record not found")) {
    return {
      reason:
        "Could not find the translated chapter associated with this post.",
      suggestion:
        "The translation record may have been removed or unlinked. You can safely reject this report.",
    };
  }

  if (
    message.includes("Record to update not found") ||
    message.includes("P2025")
  ) {
    return {
      reason: "Target comic post could not be found in the database.",
      suggestion:
        "The post may have been removed or had its ID changed. You can safely reject this report.",
    };
  }

  if (message.includes("scrape") || message.includes("fetch")) {
    return {
      reason: "Failed to fetch media metadata from Twitter/X or Pixiv.",
      suggestion:
        "The target post may be restricted or rate-limited. Please try again later.",
    };
  }

  return {
    reason: "An unexpected technical error occurred while applying changes.",
    suggestion:
      "Please retry in a few moments or contact the administrator if this persists.",
  };
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Discord interactions endpoint is active. Only POST is accepted.",
  });
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const rawBody = await req.text();

  const CLIENT_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

  if (!signature || !timestamp || !CLIENT_PUBLIC_KEY) {
    return NextResponse.json(
      { error: "Missing signature or public key" },
      { status: 401 },
    );
  }

  const isValid = await verifyKey(
    rawBody,
    signature,
    timestamp,
    CLIENT_PUBLIC_KEY,
  );

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const interaction = JSON.parse(rawBody);

  // 1. Phản hồi PING cho Discord handshake
  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  // 2. Xử lý tương tác từ nút bấm (Message Component)
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const customId = interaction.data?.custom_id as string;
    if (!customId) {
      return NextResponse.json({ error: "Invalid component" }, { status: 400 });
    }

    const [action, reportId] = customId.split(":");
    const modUsername =
      interaction.member?.user?.global_name ||
      interaction.member?.user?.username ||
      interaction.user?.username ||
      "A Moderator";

    // Phản hồi Defer ngay lập tức cho Discord (< 50ms) để không bị timeout 3s
    const immediateResponse = NextResponse.json({
      type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
    });

    const resolveOriginalPostId = async (postId: string) => {
      const direct = await prisma.originalPost.findFirst({
        where: { OR: [{ id: postId }, { tweetId: postId }] },
        select: { id: true },
      });
      if (direct) return direct.id;

      const translated = await prisma.translatedPost.findFirst({
        where: { OR: [{ id: postId }, { tweetId: postId }] },
        select: { originalPostId: true },
      });
      return translated?.originalPostId || null;
    };

    waitUntil(
      (async () => {
        const webhookEditUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
        const webhookFollowupUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`;

        try {
          const report = await prisma.comicReport.findUnique({
            where: { id: reportId },
          });

          if (!report) {
            await fetch(webhookEditUrl, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: "⚠️ This report no longer exists in the database.",
                embeds: [],
                components: [],
              }),
            });
            return;
          }

          // =============================================================
          // ACTION 1: APPROVE
          // =============================================================
          if (action === "approve") {
            const lock = await prisma.comicReport.updateMany({
              where: {
                id: reportId,
                status: "PENDING",
              },
              data: {
                status: "APPROVED",
                handledBy: modUsername,
              },
            });

            if (lock.count === 0) {
              await fetch(webhookFollowupUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content:
                    "⚠️ This report is already being processed or has been completed by another moderator.",
                  flags: 64,
                }),
              });
              return;
            }

            const targetOriginalPostId = await resolveOriginalPostId(
              report.postId,
            );

            if (!targetOriginalPostId) {
              await prisma.comicReport.update({
                where: { id: reportId },
                data: { status: "PENDING", handledBy: null },
              });

              await fetch(webhookFollowupUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content: `⚠️ Could not find any original post associated with ID: \`${report.postId}\``,
                  flags: 64,
                }),
              });
              return;
            }

            let appliedDetails = report.content;

            // --- 1.1 XỬ LÝ ORIGINAL_LINK (HỖ TRỢ CẢ TWITTER VÀ PIXIV) ---
            if (report.type === "ORIGINAL_LINK") {
              const pixivId = extractPixivId(report.content);
              const tweetIdMatch = report.content.match(/status\/(\d+)/);

              // ---------------------------------------------------------
              // TRƯỜNG HỢP A: NGUỒN PIXIV
              // ---------------------------------------------------------
              if (pixivId) {
                const pixivData = await scrapePixivMetadata(report.content);
                if (!pixivData || pixivData.mediaUrls.length === 0) {
                  throw new Error(
                    "Pixiv illustration metadata not found or has no images.",
                  );
                }

                const artistHandle = `@${pixivData.artistAccount}`;
                const creator = await prisma.creator.upsert({
                  where: { handle: artistHandle },
                  update: {
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

                const pixivUniqueId = `pixiv-${pixivId}`;
                const existingOriginalPost =
                  await prisma.originalPost.findUnique({
                    where: { tweetId: pixivUniqueId },
                  });

                let finalOriginalPostId = targetOriginalPostId;

                if (existingOriginalPost) {
                  finalOriginalPostId = existingOriginalPost.id;

                  await prisma.translatedPost.updateMany({
                    where: {
                      OR: [
                        { id: report.postId },
                        { originalPostId: targetOriginalPostId },
                      ],
                    },
                    data: { originalPostId: existingOriginalPost.id },
                  });

                  await prisma.originalPost.update({
                    where: { id: existingOriginalPost.id },
                    data: {
                      mediaUrls: pixivData.mediaUrls,
                      mediaCount: pixivData.mediaUrls.length,
                      content: pixivData.title || undefined,
                      postedAt: new Date(pixivData.postedAt),
                      artistId: creator.id,
                    },
                  });

                  // Dọn dẹp bài placeholder unknown nếu không còn bài dịch nào bám vào
                  if (targetOriginalPostId !== existingOriginalPost.id) {
                    const remaining = await prisma.translatedPost.count({
                      where: { originalPostId: targetOriginalPostId },
                    });
                    if (remaining === 0) {
                      await prisma.postTag.deleteMany({
                        where: { postId: targetOriginalPostId },
                      });
                      await prisma.originalPost
                        .delete({ where: { id: targetOriginalPostId } })
                        .catch(() => {});
                    }
                  }
                } else {
                  await prisma.originalPost.update({
                    where: { id: targetOriginalPostId },
                    data: {
                      tweetId: pixivUniqueId,
                      tweetUrl: `https://www.pixiv.net/artworks/${pixivId}`,
                      content: pixivData.title || "",
                      mediaUrls: pixivData.mediaUrls,
                      mediaCount: pixivData.mediaUrls.length,
                      postedAt: new Date(pixivData.postedAt),
                      artist: { connect: { id: creator.id } },
                    },
                  });
                }

                revalidateComicUpdates({
                  postId: report.postId,
                  originalPostId: finalOriginalPostId,
                  artistHandle: artistHandle,
                });

                appliedDetails = [
                  `🎨 **Pixiv Source Linked:** [Pixiv #${pixivId}](https://www.pixiv.net/artworks/${pixivId})`,
                  `Artist: **${pixivData.artistName}** (\`${artistHandle}\`)`,
                  `Images: **${pixivData.mediaUrls.length}** page(s)`,
                ].join(" • ");
              }
              // ---------------------------------------------------------
              // TRƯỜNG HỢP B: NGUỒN TWITTER / X
              // ---------------------------------------------------------
              else if (tweetIdMatch) {
                const tweetId = tweetIdMatch[1];
                const tweetUrl = `https://x.com/i/status/${tweetId}`;
                const scraped = await scrapeTweetData(tweetUrl);

                let artistId: string | undefined = undefined;
                let artistInfo = "";

                if (scraped?.artistHandle) {
                  const artistHandle = scraped.artistHandle;
                  const artistName = scraped.artistName || artistHandle;
                  const profileUrl = `https://x.com/${artistHandle}`;

                  const creator = await prisma.creator.upsert({
                    where: { handle: artistHandle },
                    update: { name: artistName, profileUrl },
                    create: {
                      handle: artistHandle,
                      name: artistName,
                      profileUrl,
                      role: "ARTIST",
                    },
                  });

                  artistId = creator.id;
                  artistInfo = `Artist: **${artistName}** (\`@${artistHandle}\`)`;
                }

                const existingOriginalPost =
                  await prisma.originalPost.findUnique({
                    where: { tweetId },
                  });

                let finalOriginalPostId = targetOriginalPostId;

                if (existingOriginalPost) {
                  finalOriginalPostId = existingOriginalPost.id;

                  await prisma.translatedPost.updateMany({
                    where: {
                      OR: [
                        { id: report.postId },
                        { originalPostId: targetOriginalPostId },
                      ],
                    },
                    data: {
                      originalPostId: existingOriginalPost.id,
                    },
                  });

                  if (scraped && scraped.mediaUrls.length > 0) {
                    await prisma.originalPost.update({
                      where: { id: existingOriginalPost.id },
                      data: {
                        mediaUrls: scraped.mediaUrls,
                        mediaCount: scraped.mediaUrls.length,
                        ...(scraped.text ? { content: scraped.text } : {}),
                        ...(scraped.postedAt
                          ? { postedAt: scraped.postedAt }
                          : {}),
                        ...(artistId ? { artistId } : {}),
                      },
                    });
                  }

                  if (targetOriginalPostId !== existingOriginalPost.id) {
                    const remaining = await prisma.translatedPost.count({
                      where: { originalPostId: targetOriginalPostId },
                    });

                    if (remaining === 0) {
                      await prisma.postTag.deleteMany({
                        where: { postId: targetOriginalPostId },
                      });
                      await prisma.originalPost
                        .delete({ where: { id: targetOriginalPostId } })
                        .catch(() => {});
                    }
                  }
                } else {
                  const updateData: Prisma.OriginalPostUpdateInput = {
                    tweetId,
                    tweetUrl,
                    ...(artistId
                      ? { artist: { connect: { id: artistId } } }
                      : {}),
                  };

                  if (scraped && scraped.mediaUrls.length > 0) {
                    updateData.mediaUrls = scraped.mediaUrls;
                    updateData.mediaCount = scraped.mediaUrls.length;
                    if (scraped.text) updateData.content = scraped.text;
                    if (scraped.postedAt)
                      updateData.postedAt = scraped.postedAt;
                  }

                  await prisma.originalPost.update({
                    where: { id: targetOriginalPostId },
                    data: updateData,
                  });
                }

                revalidateComicUpdates({
                  postId: report.postId,
                  originalPostId: finalOriginalPostId,
                  artistHandle: scraped?.artistHandle,
                });

                const imgCount = scraped?.mediaUrls.length || 0;
                appliedDetails = [
                  existingOriginalPost
                    ? `🔗 Linked to Existing Original Post (\`${finalOriginalPostId}\`)`
                    : `Updated Tweet URL: ${tweetUrl}`,
                  artistInfo,
                  imgCount > 0 ? `Fetched **${imgCount}** raw image(s)` : "",
                ]
                  .filter(Boolean)
                  .join(" • ");
              } else {
                throw new Error(
                  "Invalid link: Must be a Twitter/X or Pixiv artwork URL.",
                );
              }
            }

            // --- 1.2 XỬ LÝ CHARACTER_TAG ---
            else if (report.type === "CHARACTER_TAG") {
              let tagData: {
                action: string;
                tags?: string[];
                tag?: string;
                oldTag?: string;
                newTag?: string;
              } = { action: "ADD" };

              try {
                tagData = JSON.parse(report.content);
              } catch {
                tagData = { action: "ADD", tag: report.content.trim() };
              }

              const targetTags: string[] = Array.isArray(tagData.tags)
                ? tagData.tags.map((t) => t.trim()).filter(Boolean)
                : tagData.tag
                  ? tagData.tag
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                  : [];

              const affectedSlugs: string[] = [];

              if (tagData.action === "ADD" && targetTags.length > 0) {
                for (const tagName of targetTags) {
                  const slug = slugify(tagName) || `tag-${Date.now()}`;
                  affectedSlugs.push(slug);

                  const tag = await prisma.tag.upsert({
                    where: { name: tagName },
                    update: {},
                    create: {
                      name: tagName,
                      slug,
                      category: "CHARACTER",
                    },
                  });

                  await prisma.postTag.upsert({
                    where: {
                      postId_tagId: {
                        postId: targetOriginalPostId,
                        tagId: tag.id,
                      },
                    },
                    update: { isManual: true },
                    create: {
                      postId: targetOriginalPostId,
                      tagId: tag.id,
                      isManual: true,
                    },
                  });
                }

                appliedDetails = `➕ Added Tag(s): ${targetTags
                  .map((t) => `**${t}**`)
                  .join(", ")}`;
              } else if (tagData.action === "REMOVE" && targetTags.length > 0) {
                for (const tagName of targetTags) {
                  const slug = slugify(tagName);
                  if (slug) affectedSlugs.push(slug);

                  const tag = await prisma.tag.findUnique({
                    where: { name: tagName },
                  });

                  if (tag) {
                    await prisma.postTag.deleteMany({
                      where: {
                        postId: targetOriginalPostId,
                        tagId: tag.id,
                      },
                    });
                  }
                }

                appliedDetails = `❌ Removed Tag(s): ${targetTags
                  .map((t) => `**${t}**`)
                  .join(", ")}`;
              } else if (
                tagData.action === "REPLACE" &&
                tagData.oldTag &&
                tagData.newTag
              ) {
                if (tagData.oldTag) affectedSlugs.push(slugify(tagData.oldTag));
                if (tagData.newTag) affectedSlugs.push(slugify(tagData.newTag));

                const oldTag = await prisma.tag.findUnique({
                  where: { name: tagData.oldTag },
                });

                if (oldTag) {
                  await prisma.postTag.deleteMany({
                    where: {
                      postId: targetOriginalPostId,
                      tagId: oldTag.id,
                    },
                  });
                }

                const newSlug = slugify(tagData.newTag) || `tag-${Date.now()}`;
                const newTag = await prisma.tag.upsert({
                  where: { name: tagData.newTag },
                  update: {},
                  create: {
                    name: tagData.newTag,
                    slug: newSlug,
                    category: "CHARACTER",
                  },
                });

                await prisma.postTag.upsert({
                  where: {
                    postId_tagId: {
                      postId: targetOriginalPostId,
                      tagId: newTag.id,
                    },
                  },
                  update: { isManual: true },
                  create: {
                    postId: targetOriginalPostId,
                    tagId: newTag.id,
                    isManual: true,
                  },
                });

                appliedDetails = `🔄 Replaced: **${tagData.oldTag}** ➔ **${tagData.newTag}**`;
              }

              revalidateComicUpdates({
                postId: report.postId,
                originalPostId: targetOriginalPostId,
                characterSlugs: affectedSlugs,
              });
            }

            // --- 1.3 XỬ LÝ BROKEN_MEDIA ---
            else if (report.type === "BROKEN_MEDIA") {
              let mediaData: {
                target?: "ORIGINAL" | "TRANSLATED";
                tweetUrl?: string;
                note?: string;
              } = {};

              try {
                mediaData = JSON.parse(report.content);
              } catch {
                mediaData = {
                  target: "TRANSLATED",
                  tweetUrl: report.content.trim(),
                };
              }

              if (!mediaData.tweetUrl) {
                throw new Error("Missing source URL to scrape images.");
              }

              let mediaUrls: string[] = [];
              let textContent: string | undefined = undefined;

              const pixivId = extractPixivId(mediaData.tweetUrl);

              if (pixivId) {
                const pixivScraped = await scrapePixivMetadata(
                  mediaData.tweetUrl,
                );
                if (!pixivScraped || pixivScraped.mediaUrls.length === 0) {
                  throw new Error(
                    "No images found in the provided Pixiv artwork.",
                  );
                }
                mediaUrls = pixivScraped.mediaUrls;
                textContent = pixivScraped.title;
              } else {
                const scraped = await scrapeTweetData(mediaData.tweetUrl);
                if (!scraped || scraped.mediaUrls.length === 0) {
                  throw new Error(
                    "No images found in the provided Twitter post.",
                  );
                }
                mediaUrls = scraped.mediaUrls;
                textContent = scraped.text;
              }

              const isOriginal = mediaData.target === "ORIGINAL";

              if (isOriginal) {
                await prisma.originalPost.update({
                  where: { id: targetOriginalPostId },
                  data: {
                    mediaUrls,
                    mediaCount: mediaUrls.length,
                    ...(textContent ? { content: textContent } : {}),
                  },
                });

                appliedDetails = `🖼️ **Restored Raw Images:** Replaced with **${mediaUrls.length}** image(s) from [Source](${mediaData.tweetUrl})`;
              } else {
                const translatedPost = await prisma.translatedPost.findFirst({
                  where: {
                    OR: [
                      { id: report.postId },
                      { originalPostId: targetOriginalPostId },
                    ],
                  },
                });

                if (!translatedPost) {
                  throw new Error("Translated comic record not found.");
                }

                await prisma.translatedPost.update({
                  where: { id: translatedPost.id },
                  data: {
                    mediaUrls,
                  },
                });

                appliedDetails = `🌐 **Restored Translated Images:** Replaced with **${mediaUrls.length}** image(s) from [Source](${mediaData.tweetUrl})`;
              }

              revalidateComicUpdates({
                postId: report.postId,
                originalPostId: targetOriginalPostId,
              });
            }

            // Gửi PATCH cập nhật embed thành công và gỡ nút
            await fetch(webhookEditUrl, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [
                  {
                    title: `✅ Report #${report.id} APPROVED`,
                    color: 0x22c55e,
                    fields: [
                      {
                        name: "Original Post ID",
                        value: `\`${targetOriginalPostId}\``,
                        inline: true,
                      },
                      {
                        name: "Type",
                        value: `\`${report.type}\``,
                        inline: true,
                      },
                      {
                        name: "Approved By",
                        value: `**${modUsername}**`,
                        inline: true,
                      },
                      { name: "Applied Action", value: appliedDetails },
                    ],
                    footer: {
                      text: "Umazing Index • Status Updated",
                    },
                    timestamp: new Date().toISOString(),
                  },
                ],
                components: [],
              }),
            });
          }

          // =============================================================
          // ACTION 2: REJECT
          // =============================================================
          else if (action === "reject") {
            const lock = await prisma.comicReport.updateMany({
              where: {
                id: reportId,
                status: "PENDING",
              },
              data: {
                status: "REJECTED",
                handledBy: modUsername,
              },
            });

            if (lock.count === 0) {
              await fetch(webhookFollowupUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content: "⚠️ This report has already been processed.",
                  flags: 64,
                }),
              });
              return;
            }

            await fetch(webhookEditUrl, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [
                  {
                    title: `❌ Report #${report.id} REJECTED`,
                    color: 0xef4444,
                    fields: [
                      {
                        name: "Report ID",
                        value: `\`${report.id}\``,
                        inline: true,
                      },
                      {
                        name: "Type",
                        value: `\`${report.type}\``,
                        inline: true,
                      },
                      {
                        name: "Rejected By",
                        value: `**${modUsername}**`,
                        inline: true,
                      },
                      {
                        name: "Submitted Content",
                        value: report.content || "*(Empty)*",
                      },
                    ],
                    footer: { text: "Umazing Index • Dismissed" },
                    timestamp: new Date().toISOString(),
                  },
                ],
                components: [],
              }),
            });
          }
        } catch (err) {
          console.error("Background task error:", err);

          await prisma.comicReport
            .update({
              where: { id: reportId },
              data: {
                status: "PENDING",
                handledBy: null,
              },
            })
            .catch(() => {});

          const { reason, suggestion } = formatFriendlyError(err);

          await fetch(webhookEditUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              embeds: [
                {
                  title: `⚠️ Action Failed: Report #${reportId}`,
                  color: 0xf59e0b,
                  fields: [
                    { name: "📌 Reason", value: reason, inline: false },
                    {
                      name: "💡 Suggestion",
                      value: suggestion,
                      inline: false,
                    },
                    {
                      name: "Attempted By",
                      value: `**${modUsername}**`,
                      inline: true,
                    },
                  ],
                  footer: {
                    text: "Umazing Index • Action aborted, report restored to PENDING",
                  },
                  timestamp: new Date().toISOString(),
                },
              ],
              components: [],
            }),
          });
        }
      })(),
    );

    return immediateResponse;
  }

  return NextResponse.json({ error: "Unhandled interaction" }, { status: 400 });
}
