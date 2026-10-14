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
  const result = await getPostById(id);

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

  // Ưu tiên lấy ảnh trang dịch đầu tiên làm cover embed, nếu không có thì lấy ảnh raw
  const previewImage = post.transMediaUrls[0] || post.origMediaUrls[0];
  const images = previewImage ? [{ url: previewImage, alt: title }] : [];

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.uma-index.top";
  const canonicalUrl = `${siteUrl}/post/${id}`;

  return {
    title: `${title} | Uma Musume Archive`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
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
  };

  const result = await getPostById(id, filters);

  if (!result) {
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
