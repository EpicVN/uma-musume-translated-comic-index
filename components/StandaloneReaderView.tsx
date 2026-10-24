"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useCallback, ComponentProps, useMemo } from "react";
import ReaderModal from "@/components/ReaderModal";
import { useReadingTracker } from "@/hooks/useReadingTracker";
import { BookmarkItem, ReadingHistoryItem } from "@/types/storage";

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
  const fromSource = searchParams.get("from"); // 'bookmarks' | 'history' | null

  // 1. Lấy dữ liệu client từ localStorage
  const { bookmarks, history } = useReadingTracker();

  const activeList: (BookmarkItem | ReadingHistoryItem)[] = useMemo(() => {
    if (fromSource === "bookmarks") return bookmarks;
    if (fromSource === "history") return history;
    return [];
  }, [fromSource, bookmarks, history]);

  // 2. Định vị bài viết hiện tại trong danh sách Library
  const { prevLibItem, nextLibItem } = useMemo(() => {
    if (!fromSource || activeList.length === 0) {
      return { prevLibItem: null, nextLibItem: null };
    }

    // Tìm index khớp theo cả origId lẫn tweetId
    const currentIndex = activeList.findIndex((item) => {
      const matchOrig =
        item.origId && (item.origId === post.origId || item.origId === post.id);
      const matchTrans =
        item.tweetId === post.transId ||
        item.tweetId === post.id ||
        item.tweetId === post.origId;

      return matchOrig || matchTrans;
    });

    // In log kiểm tra trực tiếp trên F12 Console
    console.log("🔍 [Library Nav Check]", {
      fromSource,
      totalItems: activeList.length,
      currentIndex,
      currentPostOrigId: post.origId,
      currentPostTransId: post.transId,
    });

    if (currentIndex === -1) {
      return { prevLibItem: null, nextLibItem: null };
    }

    // Next: phần tử kế tiếp trong danh sách (index + 1)
    // Prev: phần tử trước đó trong danh sách (index - 1)
    const nextItem =
      currentIndex < activeList.length - 1
        ? activeList[currentIndex + 1]
        : null;
    const prevItem = currentIndex > 0 ? activeList[currentIndex - 1] : null;

    return { prevLibItem: prevItem, nextLibItem: nextItem };
  }, [fromSource, activeList, post]);

  // Làm sạch query param khi thoát Reader về lại trang chủ
  const cleanNavQueryStr = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tl");
    params.delete("from");
    return params.toString() ? `?${params.toString()}` : "";
  }, [searchParams]);

  // 3. Đóng bài đọc
  const handleClose = useCallback(() => {
    if (fromSource === "bookmarks" || fromSource === "history") {
      router.push("/library");
      return;
    }
    router.push(`/${cleanNavQueryStr}`);
  }, [router, fromSource, cleanNavQueryStr]);

  // 4. Chuyển bài kế tiếp
  const handleNext = useCallback(() => {
    // 🌟 ƯU TIÊN 1: Chuyển theo thứ tự danh sách Library nếu mở từ Library
    if (fromSource && nextLibItem) {
      const targetOrigId = nextLibItem.origId || nextLibItem.tweetId;
      router.replace(
        `/post/${targetOrigId}?tl=${nextLibItem.tweetId}&from=${fromSource}`,
        { scroll: false },
      );
      return;
    }

    // ƯU TIÊN 2: Chuyển theo Database Server nếu mở từ Feed chính
    if (nextId) {
      router.replace(`/post/${nextId}${cleanNavQueryStr}`, { scroll: false });
    }
  }, [fromSource, nextLibItem, nextId, cleanNavQueryStr, router]);

  // 5. Lùi về bài trước
  const handlePrev = useCallback(() => {
    // 🌟 ƯU TIÊN 1: Lùi theo thứ tự danh sách Library nếu mở từ Library
    if (fromSource && prevLibItem) {
      const targetOrigId = prevLibItem.origId || prevLibItem.tweetId;
      router.replace(
        `/post/${targetOrigId}?tl=${prevLibItem.tweetId}&from=${fromSource}`,
        { scroll: false },
      );
      return;
    }

    // ƯU TIÊN 2: Lùi theo Database Server nếu mở từ Feed chính
    if (prevId) {
      router.replace(`/post/${prevId}${cleanNavQueryStr}`, { scroll: false });
    }
  }, [fromSource, prevLibItem, prevId, cleanNavQueryStr, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  // Xác định cờ hasNext / hasPrev hiển thị nút bấm
  const hasNextPost = fromSource ? Boolean(nextLibItem) : Boolean(nextId);
  const hasPrevPost = fromSource ? Boolean(prevLibItem) : Boolean(prevId);

  return (
    <div className="min-h-screen bg-[#0b1622] flex items-center justify-center">
      <ReaderModal
        isOpen={true}
        post={post}
        onClose={handleClose}
        onNext={handleNext}
        onPrev={handlePrev}
        hasNext={hasNextPost}
        hasPrev={hasPrevPost}
      />
    </div>
  );
}
