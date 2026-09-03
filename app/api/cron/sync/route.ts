import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeTweetMetadata } from '@/lib/scraper';
import { chromium } from 'playwright';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Kiểm tra mã Secret để bảo vệ Endpoint
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Lấy danh sách Translator được đánh dấu theo dõi tự động
    const targetTranslators = await prisma.creator.findMany({
      where: { isTarget: true },
    });

    if (targetTranslators.length === 0) {
      return NextResponse.json({ message: 'Không có translator nào có isTarget = true.' });
    }

    const processedLogs: Array<{ translator: string; tweetId: string; status: string; reason?: string }> = [];

    // 3. Khởi tạo trình duyệt Playwright với Cookie xác thực
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    // Bơm Cookie từ file .env vào context duyệt web
    if (process.env.TWITTER_AUTH_TOKEN && process.env.TWITTER_CT0) {
      await context.addCookies([
        {
          name: 'auth_token',
          value: process.env.TWITTER_AUTH_TOKEN,
          domain: '.x.com',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'None',
        },
        {
          name: 'ct0',
          value: process.env.TWITTER_CT0,
          domain: '.x.com',
          path: '/',
          secure: true,
          sameSite: 'Lax',
        },
      ]);
    }

    const page = await context.newPage();

    // 4. Quét timeline từng translator mục tiêu
    for (const target of targetTranslators) {
      const screenName = target.handle.replace('@', '').trim();
      const profileUrl = `https://x.com/${screenName}`;

      try {
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

        // Chờ các bài tweet trên timeline hiển thị
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });

        // Bóc tách danh sách Tweet ID từ các thẻ bài viết
        const tweetIds: string[] = await page.evaluate(() => {
          const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
          const ids: string[] = [];

          articles.forEach((art) => {
            const link = art.querySelector('a[href*="/status/"]');
            if (link) {
              const href = link.getAttribute('href') || '';
              const match = href.match(/status\/(\d+)/);
              if (match) ids.push(match[1]);
            }
          });

          return Array.from(new Set(ids));
        });

        // Chỉ kiểm tra 5 bài viết gần nhất để tiết kiệm thời gian
        const recentIds = tweetIds.slice(0, 5);

        for (const tId of recentIds) {
          // Bỏ qua nếu tweet này đã được index trong database
          const isExisted = await prisma.translatedPost.findUnique({
            where: { tweetId: tId },
          });

          if (isExisted) continue;

          const transTweetUrl = `https://x.com/${screenName}/status/${tId}`;
          const transData = await scrapeTweetMetadata(transTweetUrl);

          if (!transData) continue;

          // Điều kiện 1: Bắt buộc là Quote Tweet và có chứa ảnh manga
          if (!transData.quotedTweetUrl || !transData.hasMedia) {
            continue;
          }

          // Điều kiện 2: Kiểm tra bắt buộc có Hashtag #UmaTranslations (hoặc các tag trong filterTags)
          const filterTags = target.filterTags && target.filterTags.trim() !== ''
            ? target.filterTags.split(',').map((t) => t.trim().toLowerCase())
            : ['#umatranslations'];

          const contentLower = transData.text.toLowerCase();
          const hasValidTag = filterTags.some((tag) => contentLower.includes(tag));

          if (!hasValidTag) {
            processedLogs.push({
              translator: target.handle,
              tweetId: tId,
              status: 'skipped',
              reason: 'Không chứa hashtag nhận diện',
            });
            continue;
          }

          // Điều kiện đạt chuẩn -> Tiếp tục bóc tách Tweet tranh gốc
          const origData = await scrapeTweetMetadata(transData.quotedTweetUrl);
          if (!origData) {
            processedLogs.push({
              translator: target.handle,
              tweetId: tId,
              status: 'failed',
              reason: 'Không lấy được metadata từ link bài gốc',
            });
            continue;
          }

          // 5. Lưu Artist (Họa sĩ gốc)
          const artist = await prisma.creator.upsert({
            where: { handle: origData.handle },
            update: { name: origData.name },
            create: {
              handle: origData.handle,
              name: origData.name,
              profileUrl: `https://x.com/${origData.handle.replace('@', '')}`,
            },
          });

          // 6. Lưu OriginalPost (Bài gốc)
          const originalPost = await prisma.originalPost.upsert({
            where: { tweetId: origData.tweetId },
            update: {},
            create: {
              tweetId: origData.tweetId,
              tweetUrl: origData.tweetUrl,
              postedAt: new Date(origData.postedAt),
              content: origData.text,
              artistId: artist.id,
            },
          });

          // 7. Lưu TranslatedPost (Bài dịch)
          await prisma.translatedPost.create({
            data: {
              tweetId: transData.tweetId,
              tweetUrl: transData.tweetUrl,
              language: 'en',
              postedAt: new Date(transData.postedAt),
              translatorId: target.id,
              originalPostId: originalPost.id,
            },
          });

          processedLogs.push({
            translator: target.handle,
            tweetId: tId,
            status: 'success',
            reason: 'Đã index bài dịch tự động',
          });
        }
      } catch (err: unknown) {
        console.error(`Lỗi quét user ${target.handle}:`, err);
        processedLogs.push({
          translator: target.handle,
          tweetId: 'N/A',
          status: 'error',
          reason: err instanceof Error ? err.message : 'Timeout hoặc lỗi tải timeline',
        });
      }
    }

    // Đóng browser giải phóng tài nguyên RAM
    await browser.close();

    return NextResponse.json({
      success: true,
      count: processedLogs.length,
      logs: processedLogs,
    });
  } catch (error: unknown) {
    console.error('Lỗi cron sync:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}