"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useCallback, ComponentProps, useMemo } from "react";
import ReaderModal from "@/components/ReaderModal";

type ReaderModalPost = NonNullable<ComponentProps<typeof ReaderModal>["post"]>;

interface StandaloneReaderViewProps {
  post: ReaderModalPost;
  prevId?: string | null;
  nextId?: string | null;
}

export default function StandaloneReaderView({
  post,
  prevId,
  nextId,
}: StandaloneReaderViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Giữ lại toàn bộ query param của bộ lọc (?tag=...&artist=...&sort=...)
  const queryStr = useMemo(() => {
    const params = searchParams.toString();
    return params ? `?${params}` : "";
  }, [searchParams]);

  // Đóng bài đọc: Trở về trang Feed kèm lại các bộ lọc đang chọn
  const handleClose = useCallback(() => {
    router.push(`/${queryStr}`);
  }, [router, queryStr]);

  // Chuyển bài kế tiếp giữ nguyên bộ lọc
  const handleNext = useCallback(() => {
    if (nextId) {
      router.push(`/post/${nextId}${queryStr}`);
    }
  }, [router, nextId, queryStr]);

  // Lùi bài trước giữ nguyên bộ lọc
  const handlePrev = useCallback(() => {
    if (prevId) {
      router.push(`/post/${prevId}${queryStr}`);
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
    <div className="min-h-screen bg-[#0b1622] flex items-center justify-center">
      <ReaderModal
        isOpen={true}
        post={post}
        onClose={handleClose}
        onNext={handleNext}
        onPrev={handlePrev}
        hasNext={Boolean(nextId)}
        hasPrev={Boolean(prevId)}
      />
    </div>
  );
}
