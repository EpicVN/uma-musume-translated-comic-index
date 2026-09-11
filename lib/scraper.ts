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
  photos?: string[];
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

  // Indonesian keywords & phrases
  "indonesian translation",
  "indonesian trans",
  "terjemahan indonesia",
  "terjemahan bahasa",
  "terjemahan",
  "bahasa indonesia",
  "bahasa",
  "indonesia",
  "indonesian",
  "IDTL",
  // Japanese text specifically indicating Indonesian
  "インドネシア語翻訳",
  "インドネシア語訳",
  "インドネシア訳",
  "インドネシア語",

  // Other non-English languages
  "tradução",
  "traducao",
  "português",
  "portugues",
  "traduction",

  // other games
  "#gakumas",
  "学マス",
  "Kaguya",
  "Blue Archive",
  "Arknights",
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
      // 1. Kiểm tra từ khóa Blacklist (Tây Ban Nha, Indo, Bồ Đào Nha,...)
      const isBlacklisted = EXCLUDED_LANG_KEYWORDS.some((kw) =>
        tweetText.includes(kw.toLowerCase()),
      );

      if (isBlacklisted) {
        console.log(`🚫 [Chặn Blacklist] Tweet ${tweetId} chứa từ khóa Non-EN`);
        return null;
      }

      // 2. Chặn nếu Twitter nhận diện dứt khoát là tiếng Tây Ban Nha ('es') hoặc tiếng Indo ('id')
      if (data.lang === "es" || data.lang === "id") {
        console.log(
          `🚫 [Chặn Twitter Lang] Tweet ${tweetId} có lang = '${data.lang}'`,
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

    // Trích xuất link ảnh gốc độ phân giải cao
    const photos: string[] = [];
    if (data.photos && Array.isArray(data.photos)) {
      data.photos.forEach((p: { url?: string }) => {
        if (p.url) {
          const orig = p.url.replace(/name=[a-zA-Z0-9]+/, "name=orig");
          if (!photos.includes(orig)) photos.push(orig);
        }
      });
    } else if (data.mediaDetails && Array.isArray(data.mediaDetails)) {
      data.mediaDetails.forEach((m: { media_url_https?: string }) => {
        if (m.media_url_https) {
          const orig = `${m.media_url_https}?name=orig`;
          if (!photos.includes(orig)) photos.push(orig);
        }
      });
    }

    const hasMedia = photos.length > 0;

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
      photos,
    };
  } catch (error) {
    console.error(`Lỗi bóc tách metadata tweet ${tweetId}:`, error);
    return null;
  }
}
