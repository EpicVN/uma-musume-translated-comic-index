import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeTweetMetadata } from '@/lib/scraper';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let origUrl = body.origUrl?.trim();
    const transUrl = body.transUrl?.trim();
    const language = body.language || 'en';

    if (!transUrl) {
      return NextResponse.json({ error: 'Cần cung cấp link bài dịch' }, { status: 400 });
    }

    // 1. Cào thông tin bài dịch trước
    const transData = await scrapeTweetMetadata(transUrl);
    if (!transData) {
      return NextResponse.json({ error: 'Không thể cào dữ liệu từ link bài dịch' }, { status: 400 });
    }

    // 2. Nếu không điền link gốc, tự động lấy từ Quote Tweet
    if (!origUrl && transData.quotedTweetUrl) {
      origUrl = transData.quotedTweetUrl;
    }

    if (!origUrl) {
      return NextResponse.json(
        { error: 'Bài dịch không quote bài nào, vui lòng dán cả link gốc!' },
        { status: 400 }
      );
    }

    // 3. Cào dữ liệu bài gốc
    const origData = await scrapeTweetMetadata(origUrl);
    if (!origData) {
      return NextResponse.json({ error: 'Không thể cào dữ liệu từ link bài gốc' }, { status: 400 });
    }

    // 4. Lưu Artist và Translator
    const artist = await prisma.creator.upsert({
      where: { handle: origData.handle },
      update: { name: origData.name },
      create: {
        handle: origData.handle,
        name: origData.name,
        profileUrl: `https://x.com/${origData.handle.replace('@', '')}`,
      },
    });

    const translator = await prisma.creator.upsert({
      where: { handle: transData.handle },
      update: { name: transData.name },
      create: {
        handle: transData.handle,
        name: transData.name,
        profileUrl: `https://x.com/${transData.handle.replace('@', '')}`,
      },
    });

    // 5. Lưu Post gốc
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

    // 6. Lưu Post dịch
    const translatedPost = await prisma.translatedPost.upsert({
      where: { tweetId: transData.tweetId },
      update: {},
      create: {
        tweetId: transData.tweetId,
        tweetUrl: transData.tweetUrl,
        language,
        postedAt: new Date(transData.postedAt),
        translatorId: translator.id,
        originalPostId: originalPost.id,
      },
    });

    return NextResponse.json({ success: true, originalPost, translatedPost });
  } catch (error: unknown) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}