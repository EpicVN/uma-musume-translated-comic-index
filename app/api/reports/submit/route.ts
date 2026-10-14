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
    const { postId, type, content, honeypot } = body;

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

    // Lấy địa chỉ IP người gửi
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    // 2. Kiểm tra Rate Limit (Bỏ qua nếu đặt DISABLE_RATE_LIMIT=true trong .env.local)
    // if (process.env.DISABLE_RATE_LIMIT !== "true") {
    //   const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    //   const recentReport = await prisma.comicReport.findFirst({
    //     where: {
    //       ipAddress,
    //       createdAt: { gte: tenMinutesAgo },
    //     },
    //   });

    //   if (recentReport) {
    //     return NextResponse.json(
    //       {
    //         error:
    //           "You are submitting too fast. Please wait 10 minutes before submitting again.",
    //       },
    //       { status: 429 }
    //     );
    //   }
    // }

    // 3. Lưu báo cáo vào Cơ sở dữ liệu (PostgreSQL / Neon)
    const report = await prisma.comicReport.create({
      data: {
        postId,
        type: type as ReportType,
        content: content.trim(),
        ipAddress,
        status: "PENDING",
      },
    });

    // 4. Định dạng nội dung hiển thị thân thiện, dễ đọc cho Mod trên Discord
    let displayType = report.type.replace("_", " ");
    let formattedChange = report.content;

    if (report.type === "CHARACTER_TAG") {
      try {
        const parsed = JSON.parse(report.content);
        if (parsed.action === "ADD") {
          displayType = "Add Missing Tag";
          formattedChange = `➕ **Add Character:** \`${parsed.tag}\``;
        } else if (parsed.action === "REMOVE") {
          displayType = "Remove Redundant Tag";
          formattedChange = `❌ **Remove Character:** \`${parsed.tag}\``;
        } else if (parsed.action === "REPLACE") {
          displayType = "Replace Incorrect Tag";
          formattedChange = `🔄 **Replace:** \`${parsed.oldTag}\` ➔ \`${parsed.newTag}\``;
        }
      } catch {
        formattedChange = report.content;
      }
    } else if (report.type === "ORIGINAL_LINK") {
      displayType = "Original Tweet Link";
      formattedChange = `🔗 **Twitter Source:** ${report.content}`;
    } else if (report.type === "BROKEN_MEDIA") {
      displayType = "Broken Image Report";
      formattedChange = `🖼️ **Description:** ${report.content}`;
    } else {
      displayType = "General Feedback";
      formattedChange = `💬 **Details:** ${report.content}`;
    }

    // 5. Cấu trúc Payload gửi sang Discord API
    const discordPayload = {
      embeds: [
        {
          title: `📢 New Report for Post: \`${report.postId}\``,
          color: 0x38bdf8, // Xanh da trời
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
              value: `[🔗 Click to view comic on web](${baseUrl}/post/${report.postId})`,
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

    // 6. Gửi tin nhắn vào kênh Discord qua Bot Token hoặc Webhook
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
