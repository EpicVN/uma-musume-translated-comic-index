import { NextRequest, NextResponse } from "next/server";
import {
  verifyKey,
  InteractionType,
  InteractionResponseType,
} from "discord-interactions";
import { PrismaClient, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { scrapeTweetData } from "@/lib/api-twitter-scraper";
import { waitUntil } from "@vercel/functions";

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
    // 1. Xóa cache trang chủ (danh sách bài mới nhất)
    revalidatePath("/", "page");

    // 2. Xóa cache trang đọc truyện của bài viết
    if (options.postId) {
      revalidatePath(`/post/${options.postId}`, "page");
    }

    // Nếu bài báo cáo là bản dịch và ID khác bài gốc -> xóa luôn cache trang bài gốc
    if (options.originalPostId && options.originalPostId !== options.postId) {
      revalidatePath(`/post/${options.originalPostId}`, "page");
    }

    // 3. Xóa cache trang tác giả nếu có cập nhật Artist
    if (options.artistHandle) {
      const handle = encodeURIComponent(options.artistHandle.trim());
      revalidatePath(`/artist/${handle}`, "page");
      revalidatePath(`/creator/${handle}`, "page");
    }

    // 4. Xóa cache trang danh sách & trang chi tiết nhân vật (Khử trùng lặp)
    if (options.characterSlugs && options.characterSlugs.length > 0) {
      revalidatePath("/characters", "page");

      // Dùng Set để tránh revalidate trùng lặp nếu mảng có slug lặp lại
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

  // 1. Trùng link Tweet (Unique constraint tweetId)
  if (
    message.includes("tweetId") &&
    (message.includes("Unique constraint") ||
      message.includes("already exists"))
  ) {
    return {
      reason: "This Twitter/X link is already assigned to another comic post.",
      suggestion:
        "Please check if this post already exists, or click **Reject** if the reporter submitted the wrong link.",
    };
  }

  // 2. Tweet không chứa ảnh nào (Broken Media / Scraping)
  if (message.includes("No images found")) {
    return {
      reason: "The provided Twitter/X link does not contain any images.",
      suggestion:
        "Please check if the link points to a text tweet, video, or an incorrect URL.",
    };
  }

  // 3. Thiếu URL cào ảnh trong payload
  if (
    message.includes("Missing tweet URL") ||
    message.includes("Missing Tweet URL")
  ) {
    return {
      reason: "No Twitter/X link was provided to re-scrape images.",
      suggestion:
        "Please reject this report and ask the reporter to include a valid tweet URL.",
    };
  }

  // 4. Không tìm thấy bản ghi bài dịch (TranslatedPost)
  if (message.includes("Translated comic record not found")) {
    return {
      reason:
        "Could not find the translated chapter associated with this post.",
      suggestion:
        "The translation record may have been removed or unlinked. You can safely reject this report.",
    };
  }

  // 5. Không tìm thấy bài viết trong database (Prisma P2025)
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

  // 6. Lỗi cào dữ liệu / nghẽn mạng từ Twitter / FxTwitter
  if (message.includes("scrape") || message.includes("fetch")) {
    return {
      reason: "Failed to fetch images or tweet metadata from Twitter/X.",
      suggestion:
        "The tweet might be private, deleted, or Twitter is temporarily rate-limiting. Please try again later.",
    };
  }

  // Fallback mặc định
  return {
    reason: "An unexpected technical error occurred while applying changes.",
    suggestion:
      "Please retry in a few moments or contact the administrator if this persists.",
  };
}

// GET endpoint kiểm tra kết nối
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

  // Xác thực chữ ký từ Discord
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

    const report = await prisma.comicReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "⚠️ This report no longer exists in the database.",
          flags: 64, // Ephemeral
        },
      });
    }

    // Helper: Tự động phân giải ra đúng OriginalPost.id
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

    // =============================================================
    // ACTION 1: APPROVE (Sử dụng Atomic Lock & Defer chống 3s timeout)
    // =============================================================
    if (action === "approve") {
      // 1. BÁO NGAY CHO DISCORD TRONG 50MS ĐẦU ĐỂ DẬP TẮT TIMEOUT 3 GIÂY
      const deferredResponse = NextResponse.json({
        type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
      });

      // 2. TOÀN BỘ LOGIC DATABASE VÀ KIỂM TRA ĐƯỢC ĐẨY VÀO CHẠY NGẦM
      waitUntil(
        (async () => {
          try {
            // --- BƯỚC KHÓA BÁO CÁO (OPTIMISTIC LOCK) ---
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

            // Nếu đã có mod khác duyệt trước: Gửi tin nhắn ẩn cảnh báo cho mod này
            if (lock.count === 0) {
              await fetch(
                `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    content:
                      "⚠️ This report is already being processed or has been completed by another moderator.",
                    flags: 64, // Ephemeral: Chỉ mod vừa bấm mới nhìn thấy
                  }),
                },
              );
              return;
            }

            const targetOriginalPostId = await resolveOriginalPostId(
              report.postId,
            );

            if (!targetOriginalPostId) {
              // Rollback nếu không tìm thấy ID bài gốc
              await prisma.comicReport.update({
                where: { id: reportId },
                data: { status: "PENDING", handledBy: null },
              });

              await fetch(
                `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    content: `⚠️ Could not find any original post associated with ID: \`${report.postId}\``,
                    flags: 64,
                  }),
                },
              );
              return;
            }

            let appliedDetails = report.content;

            // --- 1. XỬ LÝ ORIGINAL_LINK (RE-LINK HOẶC CẬP NHẬT) ---
            if (report.type === "ORIGINAL_LINK") {
              const tweetIdMatch = report.content.match(/status\/(\d+)/);
              if (tweetIdMatch) {
                const tweetId = tweetIdMatch[1];
                const tweetUrl = `https://x.com/i/status/${tweetId}`;
                const scraped = await scrapeTweetData(tweetUrl);

                // 1. Đồng bộ / upsert thông tin Artist nếu cào được
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

                // 2. Kiểm tra xem tweetId của bài gốc này đã từng tồn tại trong DB chưa
                const existingOriginalPost =
                  await prisma.originalPost.findUnique({
                    where: { tweetId },
                  });

                let finalOriginalPostId = targetOriginalPostId;

                if (existingOriginalPost) {
                  // === TRƯỜNG HỢP A: BÀI GỐC ĐÃ TỒN TẠI TRƯỚC ĐÓ ===
                  finalOriginalPostId = existingOriginalPost.id;

                  // Chuyển bản dịch trỏ sang bài gốc đã có sẵn
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

                  // Cập nhật bổ sung ảnh/nội dung cho bài gốc đã có nếu trước đó bị thiếu
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

                  // Dọn dẹp bài gốc rác (ví dụ bài tạm unknown-) nếu không còn bản dịch nào bám vào
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
                  // === TRƯỜNG HỢP B: BÀI GỐC CHƯA CÓ TRONG DB (UPDATE BÌNH THƯỜNG) ===
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

                // 3. Xóa cache Next.js với ID bài gốc chính xác
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
              }
            }

            // --- 2. Xử lý CHARACTER_TAG ---
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

            // --- 3. Xử lý BROKEN_MEDIA ---
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
                throw new Error("Missing tweet URL to scrape images.");
              }

              const scraped = await scrapeTweetData(mediaData.tweetUrl);
              if (!scraped || scraped.mediaUrls.length === 0) {
                throw new Error(
                  "No images found in the provided Twitter post.",
                );
              }

              const isOriginal = mediaData.target === "ORIGINAL";

              if (isOriginal) {
                await prisma.originalPost.update({
                  where: { id: targetOriginalPostId },
                  data: {
                    mediaUrls: scraped.mediaUrls,
                    mediaCount: scraped.mediaUrls.length,
                    ...(scraped.text ? { content: scraped.text } : {}),
                  },
                });

                appliedDetails = `🖼️ **Restored Raw Images:** Replaced with **${scraped.mediaUrls.length}** image(s) from [Tweet](${mediaData.tweetUrl})`;
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
                    mediaUrls: scraped.mediaUrls,
                  },
                });

                appliedDetails = `🌐 **Restored Translated Images:** Replaced with **${scraped.mediaUrls.length}** image(s) from [Tweet](${mediaData.tweetUrl})`;
              }

              revalidateComicUpdates({
                postId: report.postId,
                originalPostId: targetOriginalPostId,
              });
            }

            // GỬI PATCH ĐỂ ĐỔI MÀU EMBED VÀ XÓA NÚT BẤM (COMPONENTS: [])
            const patchRes = await fetch(
              `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
              {
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
              },
            );

            if (!patchRes.ok) {
              console.error(
                "Failed to patch Discord original message:",
                await patchRes.text(),
              );
            }
          } catch (err) {
            console.error("Background task error:", err);

            // Rollback trạng thái về PENDING nếu gặp sự cố
            await prisma.comicReport.update({
              where: { id: reportId },
              data: {
                status: "PENDING",
                handledBy: null,
              },
            });

            const { reason, suggestion } = formatFriendlyError(err);

            await fetch(
              `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  embeds: [
                    {
                      title: `⚠️ Approval Failed: Report #${report.id}`,
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
                        {
                          name: "Action Type",
                          value: `\`${report.type}\``,
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
              },
            );
          }
        })(),
      );

      return deferredResponse;
    }

    // =============================================================
    // ACTION 3: REJECT (Atomic Lock)
    // =============================================================
    if (action === "reject") {
      // 1. Phản hồi ngay cho Discord trong 50ms đầu để tắt bộ đếm 3 giây
      const deferredResponse = NextResponse.json({
        type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
      });

      // 2. Chuyển toàn bộ tác vụ DB và cập nhật giao diện vào tiến trình ngầm
      waitUntil(
        (async () => {
          try {
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

            // Nếu đã có mod khác xử lý trước đó: gửi thông báo ẩn (ephemeral)
            if (lock.count === 0) {
              await fetch(
                `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    content: "⚠️ This report has already been processed.",
                    flags: 64, // Ephemeral
                  }),
                },
              );
              return;
            }

            // Cập nhật Embed màu đỏ và gỡ bỏ 2 nút bấm
            const patchRes = await fetch(
              `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
              {
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
                  components: [], // Xóa hoàn toàn các nút bấm
                }),
              },
            );

            if (!patchRes.ok) {
              console.error(
                "Failed to patch Discord rejection message:",
                await patchRes.text(),
              );
            }
          } catch (err) {
            console.error("Background rejection error:", err);

            // Rollback lại PENDING nếu gặp lỗi hệ thống
            await prisma.comicReport.update({
              where: { id: reportId },
              data: { status: "PENDING", handledBy: null },
            });

            await fetch(
              `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content: `⚠️ Failed to reject report #${report.id}. Please try again later.`,
                }),
              },
            );
          }
        })(),
      );

      return deferredResponse;
    }
  }

  return NextResponse.json({ error: "Unhandled interaction" }, { status: 400 });
}
