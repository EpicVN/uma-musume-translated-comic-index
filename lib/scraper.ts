export interface TweetData {
  tweetId: string;
  tweetUrl: string;
  name: string;
  handle: string;
  postedAt: string;
  text: string;
  lang?: string;
  quotedTweetId?: string;
  quotedTweetUrl?: string;
  hasMedia: boolean;
}

const EXCLUDED_LANG_KEYWORDS = [
  // Spanish keywords & phrases
  "traducción al español",
  "traduccion al español",
  "traducción al espanol",
  "traduccion al espanol",
  "traducción",
  "traduccion",
  "español",
  "espanol",
  "spanish",
  // Japanese text specifically indicating Spanish
  "スペイン訳版",
  "スペイン訳",
  // Other non-English languages
  "tradução",
  "traducao",
  "português",
  "portugues",
  "terjemahan",
  "bahasa",
  "traduction",
];

export async function scrapeTweetMetadata(
  tweetUrl: string,
  isTranslationPost: boolean = false,
): Promise<TweetData | null> {
  const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
  const tweetId = tweetIdMatch ? tweetIdMatch[1] : null;

  if (!tweetId) return null;

  try {
    const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`;
    const res = await fetch(syndicationUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const tweetText = (data.text || "").toLowerCase();

    // CHỈ áp dụng bộ lọc ngôn ngữ cho bài dịch
    if (isTranslationPost) {
      // 1. ƯU TIÊN SỐ 1: Bắt buộc kiểm tra Blacklist trước
      // Hễ dính bất kỳ từ khóa tiếng Tây Ban Nha nào là LOẠI NGAY LẬP TỨC
      const isBlacklisted = EXCLUDED_LANG_KEYWORDS.some((kw) =>
        tweetText.includes(kw.toLowerCase()),
      );

      if (isBlacklisted) {
        console.log(
          `🚫 [Chặn Blacklist] Tweet ${tweetId} chứa từ khóa tiếng Tây Ban Nha / Non-EN`,
        );
        return null;
      }

      // 2. Chặn nếu Twitter nhận diện dứt khoát là tiếng Tây Ban Nha ('es')
      if (data.lang === "es") {
        console.log(`🚫 [Chặn Twitter Lang] Tweet ${tweetId} có lang = 'es'`);
        return null;
      }

      // 3. Đảm bảo nội dung là tiếng Anh (hoặc không xác định rõ 'und', hoặc có nhãn tiếng Anh)
      const isEnglish =
        data.lang === "en" ||
        data.lang === "und" ||
        tweetText.includes("english translation") ||
        tweetText.includes("ウマ娘英訳");

      if (!isEnglish) {
        console.log(
          `🚫 [Bỏ qua Non-EN] Tweet ${tweetId} không phải tiếng Anh (lang: ${data.lang})`,
        );
        return null;
      }
    }

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

    // Kiểm tra media đính kèm
    const hasMedia = Boolean(
      (data.mediaDetails && data.mediaDetails.length > 0) ||
      (data.photos && data.photos.length > 0),
    );

    return {
      tweetId,
      tweetUrl: `https://x.com/${data.user?.screen_name || "i"}/status/${tweetId}`,
      name: data.user?.name || "Unknown",
      handle: `@${data.user?.screen_name || "unknown"}`,
      postedAt: data.created_at,
      text: data.text || "",
      lang: data.lang,
      quotedTweetId,
      quotedTweetUrl,
      hasMedia,
    };
  } catch (error) {
    console.error(`Lỗi bóc tách metadata tweet ${tweetId}:`, error);
    return null;
  }
}
