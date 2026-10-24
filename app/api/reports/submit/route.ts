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

    // 1. Chống Spam Bot bằng trường ẩn Honeypot[cite: 6]
    if (honeypot) {
      return NextResponse.json({ message: "Report submitted successfully." }); //[cite: 6]
    }

    if (!postId || !type || !content) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 },
      ); //[cite: 6]
    }

    const allowedTypes = ["CHARACTER_TAG", "ORIGINAL_LINK", "BROKEN_MEDIA"];
    if (!allowedTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid report type." },
        { status: 400 },
      ); //[cite: 6]
    }

    // Lấy địa chỉ IP người gửi[cite: 6]
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1"; //[cite: 6]

    // 2. Kiểm tra Rate Limit[cite: 6]
    if (process.env.DISABLE_RATE_LIMIT !== "true") {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000); //[cite: 6]
      const reportCount = await prisma.comicReport.count({
        where: {
          ipAddress,
          createdAt: { gte: tenMinutesAgo },
        },
      }); //[cite: 6]

      if (reportCount >= 10) {
        return NextResponse.json(
          { error: "You can only submit up to 10 reports every 10 minutes." },
          { status: 429 },
        ); //[cite: 6]
      }
    }

    // 3. Lưu báo cáo vào Cơ sở dữ liệu[cite: 6]
    const report = await prisma.comicReport.create({
      data: {
        postId,
        type: type as ReportType,
        content: content.trim(),
        ipAddress,
        status: "PENDING",
      },
    }); //[cite: 6]

    // 4. Truy vấn tìm bài viết để lấy link xem trên web[cite: 6]
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
    }); //[cite: 6]

    const origId =
      bodyOrigId ||
      targetPost?.originalPost?.id ||
      targetPost?.originalPost?.tweetId ||
      targetPost?.originalPostId; //[cite: 6]

    const transId = bodyTransId || targetPost?.tweetId || targetPost?.id; //[cite: 6]

    const comicLink =
      origId && transId
        ? `${baseUrl}/post/${origId}?tl=${transId}`
        : origId
          ? `${baseUrl}/post/${origId}`
          : `${baseUrl}/post/${postId}`; //[cite: 6]

    // Thumbnail ảnh đại diện của bài viết nếu có
    const previewThumbnail =
      targetPost?.mediaUrls?.[0] || targetPost?.originalPost?.mediaUrls?.[0];

    // 🌟 5. Định dạng nội dung hiển thị phân biệt X / Twitter và Pixiv
    let displayType = report.type.replace("_", " "); //[cite: 6]
    let formattedChange = report.content; //[cite: 6]

    if (report.type === "CHARACTER_TAG") {
      try {
        const parsed = JSON.parse(report.content); //[cite: 6]
        const tagsList: string[] = Array.isArray(parsed.tags)
          ? parsed.tags
          : parsed.tag
            ? parsed.tag
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : []; //[cite: 6]

        const tagsFormatted = tagsList
          .map((t: string) => `\`${t}\``)
          .join(", "); //[cite: 6]

        if (parsed.action === "ADD") {
          displayType = `Add Missing Tag(s) [${tagsList.length}]`; //[cite: 6]
          formattedChange = `➕ **Add Character(s):** ${tagsFormatted}`; //[cite: 6]
        } else if (parsed.action === "REMOVE") {
          displayType = `Remove Redundant Tag(s) [${tagsList.length}]`; //[cite: 6]
          formattedChange = `❌ **Remove Character(s):** ${tagsFormatted}`; //[cite: 6]
        } else if (parsed.action === "REPLACE") {
          displayType = "Replace Incorrect Tag"; //[cite: 6]
          formattedChange = `🔄 **Replace:** \`${parsed.oldTag}\` ➔ \`${parsed.newTag}\``; //[cite: 6]
        }
      } catch {
        formattedChange = report.content; //[cite: 6]
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
      displayType = "Broken Image Fix"; //[cite: 6]
      try {
        const parsed = JSON.parse(report.content); //[cite: 6]
        const targetLabel =
          parsed.target === "ORIGINAL"
            ? "🇯🇵 Original / Raw"
            : "🌐 Translated Image"; //[cite: 6]

        const isPixiv = /pixiv\.net/i.test(parsed.tweetUrl || "");
        const sourceLabel = isPixiv
          ? "🎨 **Source (Pixiv):**"
          : "🐦 **Source (X / Twitter):**";

        formattedChange =
          `🎯 **Target:** \`${targetLabel}\`\n` + //[cite: 6]
          `${sourceLabel} ${parsed.tweetUrl}` +
          (parsed.note ? `\n📝 **Note:** ${parsed.note}` : ""); //[cite: 6]
      } catch {
        formattedChange = `🖼️ **Details:** ${report.content}`; //[cite: 6]
      }
    }

    // 6. Cấu trúc Payload gửi sang Discord API
    const discordPayload = {
      embeds: [
        {
          title: `📢 New Report for Post: \`${report.postId}\``, //[cite: 6]
          color: /pixiv\.net/i.test(report.content) ? 0x0096fa : 0x38bdf8,
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
              name: "Action / Type", //[cite: 6]
              value: `\`${displayType}\``, //[cite: 6]
              inline: true, //[cite: 6]
            },
            {
              name: "Report ID", //[cite: 6]
              value: `\`${report.id}\``, //[cite: 6]
              inline: true, //[cite: 6]
            },
            {
              name: "Proposed Change", //[cite: 6]
              value: formattedChange, //[cite: 6]
              inline: false, //[cite: 6]
            },
            {
              name: "Comic Link", //[cite: 6]
              value: `[🔗 Click to view comic on web](${comicLink})`, //[cite: 6]
              inline: false, //[cite: 6]
            },
          ],
          footer: {
            text: "Umazing Index Moderation System", //[cite: 6]
          },
          timestamp: new Date().toISOString(), //[cite: 6]
        },
      ],
      components: [
        {
          type: 1, // ActionRow[cite: 6]
          components: [
            {
              type: 2, // Button[cite: 6]
              style: 3, // Success (Green)[cite: 6]
              label: "Approve", //[cite: 6]
              custom_id: `approve:${report.id}`, //[cite: 6]
            },
            {
              type: 2, // Button[cite: 6]
              style: 4, // Danger (Red)[cite: 6]
              label: "Reject", //[cite: 6]
              custom_id: `reject:${report.id}`, //[cite: 6]
            },
          ],
        },
      ],
    };

    // 7. Gửi tin nhắn vào Discord Channel qua Bot Token hoặc Webhook[cite: 6]
    const channelId = process.env.DISCORD_CHANNEL_ID; //[cite: 6]
    const botToken = process.env.DISCORD_BOT_TOKEN; //[cite: 6]
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL; //[cite: 6]

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
      ); //[cite: 6]
    } else if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      }); //[cite: 6]
    }

    return NextResponse.json({
      success: true,
      reportId: report.id,
    }); //[cite: 6]
  } catch (error: unknown) {
    console.error("Error submitting report:", error); //[cite: 6]
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    ); //[cite: 6]
  }
}
