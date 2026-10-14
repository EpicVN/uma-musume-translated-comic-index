import { NextRequest, NextResponse } from "next/server";
import {
  verifyKey,
  InteractionType,
  InteractionResponseType,
} from "discord-interactions";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Khởi tạo Prisma Client Singleton tránh cạn connection trên Serverless
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET endpoint kiểm tra kết nối (tránh lỗi 405 trên trình duyệt)
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

  // Bắt buộc dùng await vì verifyKey trả về Promise<boolean>
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
    // ACTION 1: APPROVE
    // =============================================================
    if (action === "approve") {
      if (report.status !== "PENDING") {
        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "⚠️ This report has already been processed.",
            flags: 64,
          },
        });
      }

      const targetOriginalPostId = await resolveOriginalPostId(report.postId);

      if (!targetOriginalPostId) {
        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `⚠️ Could not find any original post associated with ID: \`${report.postId}\``,
            flags: 64,
          },
        });
      }

      let appliedDetails = report.content;

      // Xử lý ORIGINAL_LINK
      if (report.type === "ORIGINAL_LINK") {
        const tweetIdMatch = report.content.match(/status\/(\d+)/);
        if (tweetIdMatch) {
          const tweetId = tweetIdMatch[1];
          await prisma.originalPost.update({
            where: { id: targetOriginalPostId },
            data: {
              tweetId,
              tweetUrl: `https://x.com/i/status/${tweetId}`,
            },
          });
          appliedDetails = `Updated Tweet URL: https://x.com/i/status/${tweetId}`;
        }
      }

      // Xử lý CHARACTER_TAG (ADD / REMOVE / REPLACE)
      else if (report.type === "CHARACTER_TAG") {
        let tagData = {
          action: "ADD",
          tag: report.content.trim(),
          oldTag: "",
          newTag: "",
        };

        try {
          const parsed = JSON.parse(report.content);
          if (parsed && typeof parsed === "object") {
            tagData = { ...tagData, ...parsed };
          }
        } catch {
          // Fallback định dạng cũ
        }

        // =========================================================
        // 1. ADD TAG: Kiểm tra xem bài đã có tag này chưa
        // =========================================================
        if (tagData.action === "ADD") {
          const existingTag = await prisma.tag.findUnique({
            where: { name: tagData.tag },
          });

          if (existingTag) {
            const alreadyAssigned = await prisma.postTag.findUnique({
              where: {
                postId_tagId: {
                  postId: targetOriginalPostId,
                  tagId: existingTag.id,
                },
              },
            });

            if (alreadyAssigned) {
              return NextResponse.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: `⚠️ Cannot approve: Tag **${tagData.tag}** is already attached to this post!`,
                  flags: 64, // Ephemeral (chỉ mod thấy)
                },
              });
            }
          }

          const tag = await prisma.tag.upsert({
            where: { name: tagData.tag },
            update: {},
            create: {
              name: tagData.tag,
              slug: slugify(tagData.tag) || `tag-${Date.now()}`,
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

          appliedDetails = `➕ Added Tag: **${tagData.tag}**`;
        }

        // =========================================================
        // 2. REMOVE TAG: Kiểm tra tag có thực sự đang gắn trên bài không
        // =========================================================
        else if (tagData.action === "REMOVE") {
          const tag = await prisma.tag.findUnique({
            where: { name: tagData.tag },
          });

          const postTag = tag
            ? await prisma.postTag.findUnique({
                where: {
                  postId_tagId: {
                    postId: targetOriginalPostId,
                    tagId: tag.id,
                  },
                },
              })
            : null;

          // Nếu tag không tồn tại hoặc không còn gắn trên bài viết
          if (!tag || !postTag) {
            return NextResponse.json({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `⚠️ Cannot approve: Tag **${tagData.tag}** does not exist on this post anymore (it may have already been removed or replaced). Please Reject this report.`,
                flags: 64, // Ephemeral
              },
            });
          }

          // Xóa liên kết tag
          await prisma.postTag.delete({
            where: {
              postId_tagId: {
                postId: targetOriginalPostId,
                tagId: tag.id,
              },
            },
          });

          appliedDetails = `❌ Removed Tag: **${tagData.tag}**`;
        }

        // =========================================================
        // 3. REPLACE TAG: Kiểm tra oldTag có thực sự còn trên bài không
        // =========================================================
        else if (tagData.action === "REPLACE") {
          const oldTag = await prisma.tag.findUnique({
            where: { name: tagData.oldTag },
          });

          const currentPostTag = oldTag
            ? await prisma.postTag.findUnique({
                where: {
                  postId_tagId: {
                    postId: targetOriginalPostId,
                    tagId: oldTag.id,
                  },
                },
              })
            : null;

          if (!oldTag || !currentPostTag) {
            return NextResponse.json({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `⚠️ Cannot approve: The tag to replace (**${tagData.oldTag}**) is not on this post!`,
                flags: 64,
              },
            });
          }

          // Gỡ tag cũ
          await prisma.postTag.delete({
            where: {
              postId_tagId: {
                postId: targetOriginalPostId,
                tagId: oldTag.id,
              },
            },
          });

          // Thêm tag mới
          const newTag = await prisma.tag.upsert({
            where: { name: tagData.newTag },
            update: {},
            create: {
              name: tagData.newTag,
              slug: slugify(tagData.newTag) || `tag-${Date.now()}`,
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
      }

      // Cập nhật trạng thái báo cáo
      await prisma.comicReport.update({
        where: { id: reportId },
        data: {
          status: "APPROVED",
          handledBy: modUsername,
        },
      });

      revalidatePath("/", "layout");

      return NextResponse.json({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          embeds: [
            {
              title: `✅ Report #${report.id} - APPROVED`,
              color: 0x22c55e,
              fields: [
                {
                  name: "Original Post ID",
                  value: `\`${targetOriginalPostId}\``,
                  inline: true,
                },
                { name: "Type", value: `\`${report.type}\``, inline: true },
                {
                  name: "Approved By",
                  value: `**${modUsername}**`,
                  inline: true,
                },
                { name: "Applied Action", value: appliedDetails },
              ],
              footer: {
                text: "Umazing Index • Status Updated (Click Undo to revert)",
              },
              timestamp: new Date().toISOString(),
            },
          ],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 2, // Secondary
                  label: "Undo Approval",
                  custom_id: `undo:${report.id}`,
                },
              ],
            },
          ],
        },
      });
    }

    // =============================================================
    // ACTION 2: UNDO APPROVAL
    // =============================================================
    if (action === "undo") {
      if (report.status !== "APPROVED") {
        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "⚠️ Only approved reports can be undone.",
            flags: 64,
          },
        });
      }

      const targetOriginalPostId = await resolveOriginalPostId(report.postId);
      let revertedDetails = "Reverted applied changes.";

      if (report.type === "CHARACTER_TAG" && targetOriginalPostId) {
        let tagData = {
          action: "ADD",
          tag: report.content.trim(),
          oldTag: "",
          newTag: "",
        };

        try {
          const parsed = JSON.parse(report.content);
          if (parsed && typeof parsed === "object") {
            tagData = { ...tagData, ...parsed };
          }
        } catch {
          // Fallback
        }

        // Hoàn tác ADD -> Xóa tag vừa thêm
        if (tagData.action === "ADD") {
          const tag = await prisma.tag.findUnique({
            where: { name: tagData.tag },
          });
          if (tag) {
            await prisma.postTag.deleteMany({
              where: {
                postId: targetOriginalPostId,
                tagId: tag.id,
              },
            });
          }
          revertedDetails = `Removed added tag: **${tagData.tag}**`;
        }

        // Hoàn tác REMOVE -> Gắn lại tag vừa xóa
        else if (tagData.action === "REMOVE") {
          const tag = await prisma.tag.findUnique({
            where: { name: tagData.tag },
          });
          if (tag) {
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
          revertedDetails = `Restored removed tag: **${tagData.tag}**`;
        }

        // Hoàn tác REPLACE -> Xóa newTag và gắn lại oldTag
        else if (tagData.action === "REPLACE") {
          const newTag = await prisma.tag.findUnique({
            where: { name: tagData.newTag },
          });
          if (newTag) {
            await prisma.postTag.deleteMany({
              where: {
                postId: targetOriginalPostId,
                tagId: newTag.id,
              },
            });
          }

          const oldTag = await prisma.tag.findUnique({
            where: { name: tagData.oldTag },
          });
          if (oldTag) {
            await prisma.postTag.upsert({
              where: {
                postId_tagId: {
                  postId: targetOriginalPostId,
                  tagId: oldTag.id,
                },
              },
              update: { isManual: true },
              create: {
                postId: targetOriginalPostId,
                tagId: oldTag.id,
                isManual: true,
              },
            });
          }
          revertedDetails = `Restored **${tagData.oldTag}** and removed **${tagData.newTag}**`;
        }
      }

      await prisma.comicReport.update({
        where: { id: reportId },
        data: {
          status: "REJECTED",
          handledBy: `${modUsername} (Undone)`,
        },
      });

      revalidatePath("/", "layout");

      return NextResponse.json({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          embeds: [
            {
              title: `↩️ Report #${report.id} - APPROVAL REVERTED`,
              color: 0xef4444,
              description: `This action was revoked by **${modUsername}**.`,
              fields: [
                {
                  name: "Original Post ID",
                  value: `\`${targetOriginalPostId || report.postId}\``,
                  inline: true,
                },
                { name: "Type", value: `\`${report.type}\``, inline: true },
                {
                  name: "Reverted By",
                  value: `**${modUsername}**`,
                  inline: true,
                },
                { name: "Action", value: revertedDetails },
              ],
              footer: { text: "Umazing Index • Status Reverted" },
              timestamp: new Date().toISOString(),
            },
          ],
          components: [],
        },
      });
    }

    // =============================================================
    // ACTION 3: REJECT
    // =============================================================
    if (action === "reject") {
      if (report.status !== "PENDING") {
        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "⚠️ This report has already been processed.",
            flags: 64,
          },
        });
      }

      await prisma.comicReport.update({
        where: { id: reportId },
        data: {
          status: "REJECTED",
          handledBy: modUsername,
        },
      });

      return NextResponse.json({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          embeds: [
            {
              title: `❌ Report #${report.id} - REJECTED`,
              color: 0xef4444,
              fields: [
                { name: "Report ID", value: `\`${report.id}\``, inline: true },
                { name: "Type", value: `\`${report.type}\``, inline: true },
                {
                  name: "Rejected By",
                  value: `**${modUsername}**`,
                  inline: true,
                },
                { name: "Submitted Content", value: report.content },
              ],
              footer: { text: "Umazing Index • Dismissed" },
              timestamp: new Date().toISOString(),
            },
          ],
          components: [],
        },
      });
    }
  }

  return NextResponse.json({ error: "Unhandled interaction" }, { status: 400 });
}
