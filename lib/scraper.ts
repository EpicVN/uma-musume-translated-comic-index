export interface TweetData {
  tweetId: string;
  tweetUrl: string;
  name: string;
  handle: string;
  postedAt: string;
  text: string;
  quotedTweetId?: string;
  quotedTweetUrl?: string;
  hasMedia: boolean;
}

export async function scrapeTweetMetadata(tweetUrl: string): Promise<TweetData | null> {
  const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
  const tweetId = tweetIdMatch ? tweetIdMatch[1] : null;

  if (!tweetId) return null;

  try {
    const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`;
    const res = await fetch(syndicationUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;

    const data = await res.json();

    // Bóc tách Quote Tweet nếu có
    let quotedTweetId: string | undefined = undefined;
    let quotedTweetUrl: string | undefined = undefined;
    if (data.quoted_tweet) {
      quotedTweetId = data.quoted_tweet.id_str;
      const authorScreenName = data.quoted_tweet.user?.screen_name;
      quotedTweetUrl = authorScreenName
        ? `https://x.com/${authorScreenName}/status/${quotedTweetId}`
        : `https://x.com/i/status/${quotedTweetId}`;
    }

    // Kiểm tra tweet có đính kèm ảnh tranh vẽ không
    const hasMedia = Boolean(
      (data.mediaDetails && data.mediaDetails.length > 0) ||
      (data.photos && data.photos.length > 0)
    );

    return {
      tweetId,
      tweetUrl: `https://x.com/${data.user.screen_name}/status/${tweetId}`,
      name: data.user.name || 'Unknown',
      handle: `@${data.user.screen_name}`,
      postedAt: data.created_at,
      text: data.text || '',
      quotedTweetId,
      quotedTweetUrl,
      hasMedia,
    };
  } catch (error) {
    console.error(`Lỗi bóc tách metadata tweet ${tweetId}:`, error);
    return null;
  }
}