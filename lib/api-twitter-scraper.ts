interface ScrapedTweet {
  id: string;
  text: string;
  artistName: string;
  artistHandle: string;
  mediaUrls: string[];
  postedAt?: Date; // 👈 Thêm dòng này
}

export async function scrapeTweetData(
  tweetUrl: string,
): Promise<ScrapedTweet | null> {
  try {
    // 1. Trích xuất Tweet ID từ link (x.com/.../status/123456789)
    const match = tweetUrl.match(/status\/(\d+)/);
    if (!match) return null;
    const tweetId = match[1];

    // 2. Gọi qua FxTwitter API (Miễn phí, cực kỳ ổn định cho bot & embed)
    const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; UmaIndexBot/1.0)",
      },
      next: { revalidate: 0 }, // Không cache
    });

    if (!res.ok) return null;
    const data = await res.json();
    const tweet = data.tweet;

    if (!tweet) return null;

    // 3. Lấy toàn bộ ảnh gốc
    const mediaUrls: string[] = [];
    if (tweet.media?.photos) {
      mediaUrls.push(...tweet.media.photos.map((p: { url: string }) => p.url));
    } else if (tweet.media?.all) {
      for (const item of tweet.media.all) {
        if (item.type === "photo") mediaUrls.push(item.url);
      }
    }

    return {
      id: tweetId,
      text: tweet.text || "",
      artistName: tweet.author?.name || "",
      artistHandle: tweet.author?.screen_name || "",
      mediaUrls,
      // FxTwitter trả về created_timestamp tính bằng giây -> đổi sang Date
      postedAt: tweet.created_timestamp
        ? new Date(tweet.created_timestamp * 1000)
        : undefined,
    };
  } catch (error) {
    console.error("Error scraping tweet:", error);
    return null;
  }
}
