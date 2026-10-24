"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useCallback, ComponentProps, useMemo } from "react";
import ReaderModal from "@/components/ReaderModal";
import { useReadingTracker } from "@/hooks/useReadingTracker";
import { BookmarkItem, ReadingHistoryItem } from "@/types/storage";

type ReaderModalPost = NonNullable<ComponentProps<typeof ReaderModal>["post"]>;

interface InterceptedReaderModalProps {
  post: ReaderModalPost;
  prevId?: string | null;
  nextId?: string | null;
}

const QUEUE_STORAGE_KEY = "uma_lib_nav_queue";

export default function InterceptedReaderModal({
  post,
  prevId,
  nextId,
}: InterceptedReaderModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSource = searchParams.get("from"); // "bookmarks" | "history" | null

  const { bookmarks, history } = useReadingTracker();

  // Snapshot thứ tự lúc vừa mở từ Library
  useEffect(() => {
    if (!fromSource) {
      sessionStorage.removeItem(QUEUE_STORAGE_KEY);
      return;
    }

    const cachedRaw = sessionStorage.getItem(QUEUE_STORAGE_KEY);
    if (!cachedRaw) {
      const sourceList = fromSource === "bookmarks" ? bookmarks : history;
      if (sourceList.length > 0) {
        sessionStorage.setItem(
          QUEUE_STORAGE_KEY,
          JSON.stringify({ source: fromSource, list: sourceList }),
        );
      }
    }
  }, [fromSource, bookmarks, history]);

  // Lấy danh sách duyệt ưu tiên
  const activeList: (BookmarkItem | ReadingHistoryItem)[] = useMemo(() => {
    if (!fromSource) return [];

    if (typeof window !== "undefined") {
      try {
        const cachedRaw = sessionStorage.getItem(QUEUE_STORAGE_KEY);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed.source === fromSource && Array.isArray(parsed.list)) {
            return parsed.list;
          }
        }
      } catch {}
    }

    return fromSource === "bookmarks" ? bookmarks : history;
  }, [fromSource, bookmarks, history]);

  // Định vị bài Trước / Sau theo danh sách Library
  const libraryNav = useMemo(() => {
    if (!fromSource || activeList.length === 0) return null;

    const currentIndex = activeList.findIndex((item) => {
      const matchOrig =
        item.origId && (item.origId === post.origId || item.origId === post.id);
      const matchTrans =
        item.tweetId === post.transId ||
        item.tweetId === post.id ||
        item.tweetId === post.origId;

      return matchOrig || matchTrans;
    });

    if (currentIndex === -1) return null;

    const nextItem =
      currentIndex < activeList.length - 1
        ? activeList[currentIndex + 1]
        : null;
    const prevItem = currentIndex > 0 ? activeList[currentIndex - 1] : null;

    return {
      nextItem,
      prevItem,
      hasNext: Boolean(nextItem),
      hasPrev: Boolean(prevItem),
    };
  }, [activeList, post.origId, post.id, post.transId, fromSource]);

  const cleanNavQueryStr = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tl");
    params.delete("from");
    return params.toString() ? `?${params.toString()}` : "";
  }, [searchParams]);

  const handleClose = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(QUEUE_STORAGE_KEY);
    }
    router.back();
  }, [router]);

  const handleNext = useCallback(() => {
    if (fromSource && libraryNav?.nextItem) {
      const targetItem = libraryNav.nextItem;
      const targetOrigId = targetItem.origId || targetItem.tweetId;
      const params = new URLSearchParams(searchParams.toString());
      params.set("tl", targetItem.tweetId);
      params.set("from", fromSource);

      router.replace(`/post/${targetOrigId}?${params.toString()}`, {
        scroll: false,
      });
      return;
    }

    if (nextId) {
      router.replace(`/post/${nextId}${cleanNavQueryStr}`, { scroll: false });
    }
  }, [fromSource, libraryNav, nextId, cleanNavQueryStr, router, searchParams]);

  const handlePrev = useCallback(() => {
    if (fromSource && libraryNav?.prevItem) {
      const targetItem = libraryNav.prevItem;
      const targetOrigId = targetItem.origId || targetItem.tweetId;
      const params = new URLSearchParams(searchParams.toString());
      params.set("tl", targetItem.tweetId);
      params.set("from", fromSource);

      router.replace(`/post/${targetOrigId}?${params.toString()}`, {
        scroll: false,
      });
      return;
    }

    if (prevId) {
      router.replace(`/post/${prevId}${cleanNavQueryStr}`, { scroll: false });
    }
  }, [fromSource, libraryNav, prevId, cleanNavQueryStr, router, searchParams]);

  const hasNextPost = fromSource
    ? Boolean(libraryNav?.hasNext)
    : Boolean(nextId);
  const hasPrevPost = fromSource
    ? Boolean(libraryNav?.hasPrev)
    : Boolean(prevId);

  return (
    <ReaderModal
      isOpen={true}
      post={post}
      onClose={handleClose}
      onNext={handleNext}
      onPrev={handlePrev}
      hasNext={hasNextPost}
      hasPrev={hasPrevPost}
    />
  );
}
