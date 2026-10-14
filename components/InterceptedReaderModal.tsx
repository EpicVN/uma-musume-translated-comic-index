"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useCallback, ComponentProps, useMemo } from "react";
import ReaderModal from "@/components/ReaderModal";

type ReaderModalPost = NonNullable<ComponentProps<typeof ReaderModal>["post"]>;

interface InterceptedReaderModalProps {
  post: ReaderModalPost;
  prevId?: string | null;
  nextId?: string | null;
}

export default function InterceptedReaderModal({
  post,
  prevId,
  nextId,
}: InterceptedReaderModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Giữ nguyên toàn bộ tham số bộ lọc (?tag=...&artist=...&sort=...)
  const queryStr = useMemo(() => {
    const params = searchParams.toString();
    return params ? `?${params}` : "";
  }, [searchParams]);

  // Đóng modal bằng router.back() để lùi về đúng vị trí lướt Feed trước đó
  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  // Chuyển bài kế tiếp nhưng vẫn giữ nguyên bộ lọc trên URL
  const handleNext = useCallback(() => {
    if (nextId) {
      router.replace(`/post/${nextId}${queryStr}`, { scroll: false });
    }
  }, [router, nextId, queryStr]);

  // Lùi về bài trước đó và giữ nguyên bộ lọc
  const handlePrev = useCallback(() => {
    if (prevId) {
      router.replace(`/post/${prevId}${queryStr}`, { scroll: false });
    }
  }, [router, prevId, queryStr]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  return (
    <ReaderModal
      isOpen={true}
      post={post}
      onClose={handleClose}
      onNext={handleNext}
      onPrev={handlePrev}
      hasNext={Boolean(nextId)}
      hasPrev={Boolean(prevId)}
    />
  );
}
