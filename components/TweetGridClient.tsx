"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import TweetGridCard from "@/components/TweetGridCard";
import ReaderModal, { ComicPostItem } from "@/components/ReaderModal";

interface TweetGridClientProps {
  posts: ComicPostItem[];
  currentPage: number;
  totalPages: number;
}

export default function TweetGridClient({
  posts,
  currentPage,
  totalPages,
}: TweetGridClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const autoRead = searchParams.get("read");
  const readPostId = searchParams.get("readPost");

  const [manualIndex, setManualIndex] = useState<number | null>(null);

  // 1. Xác định index bài viết đang chọn
  let selectedIndex: number | null = manualIndex;

  if (readPostId && posts.length > 0) {
    const foundIndex = posts.findIndex(
      (p) => p.transId === readPostId || p.origId === readPostId,
    );
    if (foundIndex !== -1) {
      selectedIndex = foundIndex;
    }
  } else if (autoRead === "first" && posts.length > 0) {
    selectedIndex = 0;
  } else if (autoRead === "last" && posts.length > 0) {
    selectedIndex = posts.length - 1;
  }

  // Hàm cập nhật URL nhẹ nhàng không gây re-render hay giật scroll
  const updateUrlParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const newQuery = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState(null, "", `${pathname}${newQuery}`);
  };

  // 2. Xử lý mở Modal khi click vào Card
  const handleOpenReader = (index: number) => {
    const targetPost = posts[index];
    if (targetPost) {
      updateUrlParam("readPost", targetPost.transId);
    }
    setManualIndex(index);
  };

  // 3. Xử lý đóng Modal
  const handleClose = () => {
    setManualIndex(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("readPost");
    params.delete("read");
    const newQuery = params.toString() ? `?${params.toString()}` : "";
    router.replace(`${pathname}${newQuery}`, { scroll: false });
  };

  // 4. Chuyển sang bài kế tiếp
  const handleNext = () => {
    if (selectedIndex === null) return;

    if (selectedIndex < posts.length - 1) {
      const nextIndex = selectedIndex + 1;
      const nextPost = posts[nextIndex];
      updateUrlParam("readPost", nextPost.transId);
      setManualIndex(nextIndex);
    } else if (currentPage < totalPages) {
      // Chuyển trang tiếp theo
      setManualIndex(null);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("readPost");
      params.set("page", String(currentPage + 1));
      params.set("read", "first");
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  // 5. Quay lại bài phía trước
  const handlePrev = () => {
    if (selectedIndex === null) return;

    if (selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      const prevPost = posts[prevIndex];
      updateUrlParam("readPost", prevPost.transId);
      setManualIndex(prevIndex);
    } else if (currentPage > 1) {
      // Lùi về trang trước
      setManualIndex(null);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("readPost");
      params.set("page", String(currentPage - 1));
      params.set("read", "last");
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const activeComic = selectedIndex !== null ? posts[selectedIndex] : null;

  const hasNext =
    selectedIndex !== null &&
    (selectedIndex < posts.length - 1 || currentPage < totalPages);

  const hasPrev =
    selectedIndex !== null && (selectedIndex > 0 || currentPage > 1);

  return (
    <>
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
            onOpenReader={() => handleOpenReader(index)}
          />
        ))}
      </div>

      <ReaderModal
        isOpen={selectedIndex !== null && activeComic !== null}
        post={activeComic}
        onClose={handleClose}
        onNext={handleNext}
        onPrev={handlePrev}
        hasNext={hasNext}
        hasPrev={hasPrev}
      />
    </>
  );
}
