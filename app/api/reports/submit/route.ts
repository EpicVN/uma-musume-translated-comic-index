import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, ReportType } from "@prisma/client";

// Khởi tạo Prisma Client Singleton tránh cạn kiệt connection pool
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.uma-index.top";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      postId,
      origId: bodyOrigId,
      transId: bodyTransId,
      type,
      content,
      honeypot,
    } = body;

    // 1. Chống Spam Bot bằng trường ẩn Honeypot
    if (honeypot) {
      return NextResponse.json({ message: "Report submitted successfully." });
    }

    if (!postId || !type || !content) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 },
      );
    }

    const allowedTypes = [
      "CHARACTER_TAG",
      "ORIGINAL_LINK",
      "BROKEN_MEDIA",
      "IRRELEVANT_CONTENT",
    ];

    if (!allowedTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid report type." },
        { status: 400 },
      );
    }

    // Lấy địa chỉ IP người gửi
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    // 2. Kiểm tra Rate Limit
    if (process.env.DISABLE_RATE_LIMIT !== "true") {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const reportCount = await prisma.comicReport.count({
        where: {
          ipAddress,
          createdAt: { gte: tenMinutesAgo },
        },
      });

      if (reportCount >= 10) {
        return NextResponse.json(
          { error: "You can only submit up to 10 reports every 10 minutes." },
          { status: 429 },
        );
      }
    }

    // 3. Lưu báo cáo vào Cơ sở dữ liệu
    const report = await prisma.comicReport.create({
      data: {
        postId,
        type: type as ReportType,
        content: content.trim(),
        ipAddress,
        status: "PENDING",
      },
    });

    // 4. Truy vấn tìm bài viết để lấy link xem trên web
    const targetPost = await prisma.translatedPost.findFirst({
      where: {
        OR: [
          { id: postId },
          { tweetId: postId },
          { originalPostId: postId },
          { originalPost: { tweetId: postId } },
        ],
      },
      select: {
        id: true,
        tweetId: true,
        originalPostId: true,
        mediaUrls: true,
        originalPost: {
          select: {
            id: true,
            tweetId: true,
            mediaUrls: true,
            artist: {
              select: {
                name: true,
                handle: true,
              },
            },
          },
        },
      },
    });

    const origId =
      bodyOrigId ||
      targetPost?.originalPost?.id ||
      targetPost?.originalPost?.tweetId ||
      targetPost?.originalPostId;

    const transId = bodyTransId || targetPost?.tweetId || targetPost?.id;

    const comicLink =
      origId && transId
        ? `${baseUrl}/post/${origId}?tl=${transId}`
        : origId
          ? `${baseUrl}/post/${origId}`
          : `${baseUrl}/post/${postId}`;

    // Thumbnail ảnh đại diện của bài viết nếu có
    const previewThumbnail =
      targetPost?.mediaUrls?.[0] || targetPost?.originalPost?.mediaUrls?.[0];

    // 🌟 5. Định dạng nội dung hiển thị phân biệt X / Twitter và Pixiv
    let displayType = report.type.replace("_", " ");
    let formattedChange = report.content;

    if (report.type === "CHARACTER_TAG") {
      try {
        const parsed = JSON.parse(report.content);
        const tagsList: string[] = Array.isArray(parsed.tags)
          ? parsed.tags
          : parsed.tag
            ? parsed.tag
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [];

        // 🌟 XỬ LÝ LÀM ĐẸP CHO HÀNH ĐỘNG "UPDATE"
        if (parsed.action === "UPDATE") {
          displayType = `Update Character Tags`;
          const added: string[] = [];
          const removed: string[] = [];

          for (let t of tagsList) {
            // Fix lỗi Frontend gửi chuỗi lặp REMOVE::REMOVE::
            t = t.replace(/^(REMOVE::)+/, "REMOVE::");

            if (t.startsWith("REMOVE::")) {
              removed.push(t.replace("REMOVE::", "").trim());
            } else {
              added.push(t.trim());
            }
          }

          const details = [];
          if (added.length > 0) {
            details.push(
              `➕ **Add:** ${added.map((t) => `\`${t}\``).join(", ")}`,
            );
          }
          if (removed.length > 0) {
            details.push(
              `❌ **Remove:** ${removed.map((t) => `\`${t}\``).join(", ")}`,
            );
          }

          formattedChange =
            details.length > 0 ? details.join("\n") : "*(No changes)*";
        }
        // Các logic cũ (Dự phòng)
        else if (parsed.action === "ADD") {
          displayType = `Add Missing Tag(s) [${tagsList.length}]`;
          formattedChange = `➕ **Add Character(s):** ${tagsList.map((t) => `\`${t}\``).join(", ")}`;
        } else if (parsed.action === "REMOVE") {
          displayType = `Remove Redundant Tag(s) [${tagsList.length}]`;
          formattedChange = `❌ **Remove Character(s):** ${tagsList.map((t) => `\`${t}\``).join(", ")}`;
        } else if (parsed.action === "REPLACE") {
          displayType = "Replace Incorrect Tag";
          formattedChange = `🔄 **Replace:** \`${parsed.oldTag}\` ➔ \`${parsed.newTag}\``;
        }
      } catch {
        formattedChange = report.content;
      }
    } else if (report.type === "ORIGINAL_LINK") {
      const rawUrl = report.content.trim();
      const isPixiv = /pixiv\.net/i.test(rawUrl);

      if (isPixiv) {
        const match =
          rawUrl.match(/artworks\/(\d+)/i) || rawUrl.match(/illust_id=(\d+)/i);
        const illustId = match ? match[1] : null;

        displayType = "Original Link (Pixiv)";
        formattedChange = `🎨 **Pixiv Artwork:** ${
          illustId ? `[#${illustId}](${rawUrl})` : rawUrl
        }`;
      } else {
        const match = rawUrl.match(/status\/(\d+)/i);
        const tweetId = match ? match[1] : null;

        displayType = "Original Link (X / Twitter)";
        formattedChange = `🐦 **X / Twitter Source:** ${
          tweetId ? `[Status #${tweetId}](${rawUrl})` : rawUrl
        }`;
      }
    } else if (report.type === "BROKEN_MEDIA") {
      displayType = "Broken Image Fix";
      try {
        const parsed = JSON.parse(report.content);
        const targetLabel =
          parsed.target === "ORIGINAL"
            ? "🇯🇵 Original / Raw"
            : "🌐 Translated Image";

        const isPixiv = /pixiv\.net/i.test(parsed.tweetUrl || "");
        const sourceLabel = isPixiv
          ? "🎨 **Source (Pixiv):**"
          : "🐦 **Source (X / Twitter):**";

        formattedChange =
          `🎯 **Target:** \`${targetLabel}\`\n` +
          `${sourceLabel} ${parsed.tweetUrl}` +
          (parsed.note ? `\n📝 **Note:** ${parsed.note}` : "");
      } catch {
        formattedChange = `🖼️ **Details:** ${report.content}`;
      }
    } else if (report.type === "IRRELEVANT_CONTENT") {
      displayType = "Not Umamusume / Irrelevant";
      formattedChange = report.content
        ? `📝 **User Note:** ${report.content}`
        : `*(No additional note provided)*`;
    }

    // 6. Cấu trúc Payload gửi sang Discord API
    const discordPayload = {
      embeds: [
        {
          title: `📢 New Report for Post: \`${report.postId}\``,
          color:
            report.type === "IRRELEVANT_CONTENT"
              ? 0xef4444
              : /pixiv\.net/i.test(report.content)
                ? 0x0096fa
                : 0x38bdf8,
          thumbnail: previewThumbnail
            ? {
                url: previewThumbnail.replace(
                  /name=[a-zA-Z0-9]+/,
                  "name=small",
                ),
              }
            : undefined,
          fields: [
            {
              name: "Action / Type",
              value: `\`${displayType}\``,
              inline: true,
            },
            {
              name: "Report ID",
              value: `\`${report.id}\``,
              inline: true,
            },
            {
              name: "Proposed Change",
              value: formattedChange,
              inline: false,
            },
            {
              name: "Comic Link",
              value: `[🔗 Click to view comic on web](${comicLink})`,
              inline: false,
            },
          ],
          footer: {
            text: "Umazing Index Moderation System",
          },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [
        {
          type: 1, // ActionRow
          components: [
            {
              type: 2, // Button
              style: 3, // Success (Green)
              label: "Approve",
              custom_id: `approve:${report.id}`,
            },
            {
              type: 2, // Button
              style: 4, // Danger (Red)
              label: "Reject",
              custom_id: `reject:${report.id}`,
            },
          ],
        },
      ],
    };

    // 7. Gửi tin nhắn vào Discord Channel qua Bot Token hoặc Webhook
    const channelId = process.env.DISCORD_CHANNEL_ID;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (channelId && botToken) {
      await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(discordPayload),
        },
      );
    } else if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
    }

    return NextResponse.json({
      success: true,
      reportId: report.id,
    });
  } catch (error: unknown) {
    console.error("Error submitting report:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
