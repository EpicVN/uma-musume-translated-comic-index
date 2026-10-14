"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TweetGridCard from "@/components/TweetGridCard";
import { ComicPostItem } from "@/components/ReaderModal";

interface TweetGridClientProps {
  posts: ComicPostItem[];
  currentPage: number;
  totalPages: number;
}

export default function TweetGridClient({ posts }: TweetGridClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 1. Tương thích ngược: Nếu ai vào bằng link cũ (?readPost=...), tự chuyển hướng sang /post/[id]
  useEffect(() => {
    const readPostId = searchParams.get("readPost");
    if (readPostId) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("readPost");
      const queryString = params.toString() ? `?${params.toString()}` : "";
      router.replace(`/post/${readPostId}${queryString}`, { scroll: false });
    }
  }, [searchParams, router]);

  // 2. Khi click vào Card: Đẩy URL sang /post/[id] kèm toàn bộ query param của bộ lọc

  const handleOpenReader = (targetId: string) => {
    // Lấy toàn bộ chuỗi query hiện tại (?mode=twitter&tag=admire-groove&page=1)
    const currentQuery = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

    // Nối currentQuery vào URL
    router.push(`/post/${targetId}${currentQuery}`, { scroll: false });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 items-start">
      {posts.map((post, index) => (
        <TweetGridCard
          key={post.id}
          origId={post.origId}
          transId={post.transId}
          artistName={post.artistName}
          translatorName={post.translatorName}
          language={post.language}
          tags={post.tags}
          postedAt={post.postedAt}
          priority={index < 4}
          origMediaUrls={post.origMediaUrls}
          transMediaUrls={post.transMediaUrls}
          onOpenReader={() => handleOpenReader(post.origId || post.id)}
        />
      ))}
    </div>
  );
}
