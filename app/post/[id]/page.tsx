import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostById } from "@/lib/get-post";
import StandaloneReaderView from "@/components/StandaloneReaderView";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// 🏷️ Cấu hình dynamic metadata cho SEO & Discord/Twitter Embed
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  // Lấy ID bản dịch được yêu cầu từ URL query (?tl=...)
  const targetTl =
    typeof searchParams.tl === "string" ? searchParams.tl : undefined;

  // Truyền kèm { tl: targetTl } để lấy đúng metadata của bản dịch đó
  const result = await getPostById(id, { tl: targetTl });

  if (!result || !result.post) {
    return {
      title: "Comic Not Found | Uma Musume Archive",
      description:
        "The requested comic could not be found or has been removed.",
    };
  }

  const { post } = result;
  const cleanTranslator = post.translatorName.replace(/^@/, "");
  const title = `${post.artistName} (TL by @${cleanTranslator})`;

  const tagList =
    post.tags && post.tags.length > 0
      ? post.tags.map((t) => `#${t.name}`).join(" ")
      : "";

  const description = tagList
    ? `Uma Musume comic by ${post.artistName}, translated into ${(post.language || "EN").toUpperCase()} by @${cleanTranslator}. Tags: ${tagList}`
    : `Uma Musume comic by ${post.artistName}, translated into ${(post.language || "EN").toUpperCase()} by @${cleanTranslator}.`;

  // Ưu tiên ảnh của bản dịch được chọn, nếu không có mới lấy ảnh gốc
  const previewImage = post.transMediaUrls[0] || post.origMediaUrls[0];
  const images = previewImage ? [{ url: previewImage, alt: title }] : [];

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.uma-index.top";

  // 🔒 CHỐT CHẶN SEO: Mọi bản dịch đều gom chỉ mục về URL gốc duy nhất
  const canonicalUrl = `${siteUrl}/post/${id}`;
  // Link mở trực tiếp bản dịch này khi chia sẻ lên mạng xã hội
  const shareUrl = targetTl ? `${canonicalUrl}?tl=${targetTl}` : canonicalUrl;

  return {
    title: `${title} | Uma Musume Archive`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: shareUrl,
      siteName: "Uma Musume Comic Archive",
      type: "article",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: previewImage ? [previewImage] : [],
      creator: `@${cleanTranslator}`,
    },
  };
}

export default async function StandalonePostPage(props: Props) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const targetTl =
    typeof searchParams.tl === "string" ? searchParams.tl : undefined;

  const filters = {
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
    tag: typeof searchParams.tag === "string" ? searchParams.tag : undefined,
    artist:
      typeof searchParams.artist === "string" ? searchParams.artist : undefined,
    translator:
      typeof searchParams.translator === "string"
        ? searchParams.translator
        : undefined,
    sort: typeof searchParams.sort === "string" ? searchParams.sort : undefined,
    tl: targetTl, // 🌟 Truyền targetTl vào bộ lọc
  };

  const result = await getPostById(id, filters);

  if (!result || !result.post) {
    return notFound();
  }

  return (
    <StandaloneReaderView
      post={result.post}
      prevId={result.prevId}
      nextId={result.nextId}
    />
  );
}
