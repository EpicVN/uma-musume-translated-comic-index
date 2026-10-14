"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import rawCharactersData from "@/config/characters.json";

interface CharacterItem {
  slug: string;
  name: string;
  jp: string;
  aliases?: string[];
}

const charactersData = rawCharactersData as CharacterItem[];

interface TagItem {
  id?: string;
  name: string;
  slug?: string;
}

interface ReportModalProps {
  postId: string;
  postTitle?: string;
  thumbnailUrl?: string;
  currentTags?: TagItem[];
}

const CATEGORIES = [
  { value: "ADD_TAG", label: "➕ Add Missing Character Tag" },
  { value: "REMOVE_TAG", label: "❌ Remove Redundant/Wrong Tag" },
  { value: "REPLACE_TAG", label: "🔄 Replace Incorrect Tag" },
  { value: "ORIGINAL_LINK", label: "🔗 Add / Update Original Twitter Link" },
  { value: "BROKEN_MEDIA", label: "🖼️ Broken / Missing Image" },
  { value: "OTHER", label: "💬 Other Feedback" },
];

export default function ReportModal({
  postId,
  postTitle,
  thumbnailUrl,
  currentTags = [],
}: ReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<string>("ADD_TAG");
  const [content, setContent] = useState("");
  const [selectedOldTag, setSelectedOldTag] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  // Quản lý Custom Dropdown danh mục (thay thế thẻ select mặc định của mobile)
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Quản lý Searchable Dropdown cho nhân vật
  const [isCharMenuOpen, setIsCharMenuOpen] = useState(false);
  const [charSearch, setCharSearch] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const charDropdownRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setIsOpen(false);
    setContent("");
    setSelectedOldTag("");
    setHoneypot("");
    setStatusMessage(null);
    setIsCharMenuOpen(false);
    setIsCategoryMenuOpen(false);
    setCharSearch("");
  }, [isSubmitting]);

  // Phím tắt Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Click outside cho cả 2 dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (e.target instanceof Element) {
        const el = e.target;
        const rect = el.getBoundingClientRect();

        // Vùng thanh cuộn dọc nằm giữa (rect.left + clientLeft + clientWidth) và rect.right
        const isClickOnVerticalScrollbar =
          e.clientX >= rect.left + el.clientLeft + el.clientWidth &&
          e.clientX <= rect.right;

        // Vùng thanh cuộn ngang nằm giữa (rect.top + clientTop + clientHeight) và rect.bottom
        const isClickOnHorizontalScrollbar =
          e.clientY >= rect.top + el.clientTop + el.clientHeight &&
          e.clientY <= rect.bottom;

        if (isClickOnVerticalScrollbar || isClickOnHorizontalScrollbar) {
          return;
        }
      }

      if (
        charDropdownRef.current &&
        !charDropdownRef.current.contains(target)
      ) {
        setIsCharMenuOpen(false);
      }
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(target)
      ) {
        setIsCategoryMenuOpen(false);
      }
    };
    if (isCharMenuOpen || isCategoryMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCharMenuOpen, isCategoryMenuOpen]);

  // Lọc danh sách nhân vật
  const filteredCharacters = charactersData.filter((char) => {
    const query = charSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      char.name.toLowerCase().includes(query) ||
      char.jp.toLowerCase().includes(query) ||
      char.slug.toLowerCase().includes(query) ||
      char.aliases?.some((alias) => alias.toLowerCase().includes(query))
    );
  });

  const isFormValid = () => {
    if (type === "REPLACE_TAG") {
      return Boolean(selectedOldTag.trim() && content.trim());
    }
    return Boolean(content.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    let finalType = type;
    let finalContent = content.trim();

    if (type === "ADD_TAG") {
      finalType = "CHARACTER_TAG";
      finalContent = JSON.stringify({ action: "ADD", tag: content.trim() });
    } else if (type === "REMOVE_TAG") {
      finalType = "CHARACTER_TAG";
      finalContent = JSON.stringify({ action: "REMOVE", tag: content.trim() });
    } else if (type === "REPLACE_TAG") {
      finalType = "CHARACTER_TAG";
      finalContent = JSON.stringify({
        action: "REPLACE",
        oldTag: selectedOldTag.trim(),
        newTag: content.trim(),
      });
    }

    try {
      const res = await fetch("/api/reports/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          type: finalType,
          content: finalContent,
          honeypot,
        }),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(
          `Server returned status ${res.status} (${res.statusText})`,
        );
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit report.");
      }

      setStatusMessage({
        text: "Thank you! Your report has been sent to our moderators.",
        isError: false,
      });

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setStatusMessage({
        text: message,
        isError: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategoryLabel =
    CATEGORIES.find((c) => c.value === type)?.label || CATEGORIES[0].label;

  const modalContent = isOpen ? (
    <div
      className="fixed inset-0 z-99999 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#0b1622] border-t sm:border border-[#27364b] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col text-white relative max-h-[92vh] overflow-hidden"
      >
        {/* Mobile handle indicator */}
        <div className="w-12 h-1 bg-[#1e2d42] rounded-full mx-auto my-2.5 shrink-0 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2d42] bg-[#0e1b2a] sm:rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[#3db4f2] text-sm">🚩</span>
            <h3 className="font-bold text-sm text-white">Report Issue</h3>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            className="text-[#8ba0b2] hover:text-white transition text-lg px-1 disabled:opacity-50 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Post Preview */}
        <div className="px-5 py-3 bg-[#132032] border-b border-[#1e2d42] flex items-center gap-3 shrink-0">
          {thumbnailUrl && (
            <Image
              src={thumbnailUrl}
              alt="Thumbnail"
              width={40}
              height={40}
              className="w-10 h-10 object-cover rounded border border-[#27364b] shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-[#8ba0b2]">Target Post:</div>
            <div className="text-xs font-semibold text-zinc-200 truncate">
              {postTitle || `ID: ${postId}`}
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto flex-1"
        >
          {/* Honeypot field */}
          <div className="hidden" aria-hidden="true">
            <input
              type="text"
              name="website_verify"
              tabIndex={-1}
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* 1. CUSTOM ISSUE CATEGORY (Tránh native white alert của Android) */}
          <div ref={categoryDropdownRef} className="relative">
            <label className="block text-xs font-medium text-[#8ba0b2] mb-1.5">
              Issue Category
            </label>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
              className="w-full bg-[#151f2e] border border-[#27364b] focus:border-[#3db4f2] text-xs text-left text-white rounded-xl px-3.5 py-3 flex items-center justify-between transition cursor-pointer disabled:opacity-50"
            >
              <span className="font-semibold text-white">
                {selectedCategoryLabel}
              </span>
              <span className="text-[#8ba0b2] text-[10px] ml-2">
                {isCategoryMenuOpen ? "▲" : "▼"}
              </span>
            </button>

            {isCategoryMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0e1b2a] border border-[#27364b] rounded-xl shadow-2xl z-70 overflow-hidden divide-y divide-[#1e2d42] max-h-56 overflow-y-auto">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      setType(cat.value);
                      setContent("");
                      setSelectedOldTag("");
                      setIsCharMenuOpen(false);
                      setCharSearch("");
                      setIsCategoryMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-xs transition cursor-pointer flex items-center justify-between hover:bg-[#1a2b40] ${
                      type === cat.value
                        ? "bg-[#1f3652] text-[#3db4f2] font-bold"
                        : "text-zinc-200"
                    }`}
                  >
                    <span>{cat.label}</span>
                    {type === cat.value && (
                      <span className="text-[#3db4f2] text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. DYNAMIC FIELDS */}
          <div>
            {/* ADD TAG */}
            {type === "ADD_TAG" && (
              <div>
                <label className="block text-xs font-medium text-[#8ba0b2] mb-1.5">
                  Select Character to Add:
                </label>
                <div ref={charDropdownRef} className="relative">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsCharMenuOpen((prev) => !prev)}
                    className="w-full bg-[#151f2e] border border-[#27364b] focus:border-[#3db4f2] text-xs text-left text-white rounded-xl px-3.5 py-3 flex items-center justify-between transition cursor-pointer disabled:opacity-50"
                  >
                    <span
                      className={
                        content ? "text-white font-medium" : "text-[#5a6f82]"
                      }
                    >
                      {content || "-- Choose a character from list --"}
                    </span>
                    <span className="text-[#8ba0b2] text-[10px] ml-2">
                      {isCharMenuOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {isCharMenuOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0e1b2a] border border-[#27364b] rounded-xl shadow-2xl z-60 overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-[#1e2d42] bg-[#132032]">
                        <input
                          type="text"
                          autoFocus
                          value={charSearch}
                          onChange={(e) => setCharSearch(e.target.value)}
                          placeholder="Type to filter (e.g. Spe, Suzuka, スペ)..."
                          className="w-full bg-[#182638] border border-[#2b3c52] focus:border-[#3db4f2] text-xs text-white placeholder-[#5a6f82] rounded-lg px-2.5 py-1.5 focus:outline-none transition"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-[#1e2d42]/50">
                        {filteredCharacters.length > 0 ? (
                          filteredCharacters.map((char) => (
                            <button
                              type="button"
                              key={char.slug}
                              onClick={() => {
                                setContent(char.name);
                                setIsCharMenuOpen(false);
                                setCharSearch("");
                              }}
                              className={`w-full text-left px-3 py-2 text-xs transition cursor-pointer flex items-center justify-between hover:bg-[#1a2b40] ${
                                content === char.name
                                  ? "bg-[#1f3652] text-[#3db4f2] font-semibold"
                                  : "text-zinc-200"
                              }`}
                            >
                              <span>{char.name}</span>
                              <span className="text-[11px] text-[#8ba0b2]">
                                {char.jp}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-4 text-center text-xs text-[#5a6f82]">
                            No character matched &quot;{charSearch}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* REMOVE TAG (Chọn bằng Tag Chips, chống popup hệ thống) */}
            {type === "REMOVE_TAG" && (
              <div>
                <label className="block text-xs font-medium text-[#8ba0b2] mb-2">
                  Select Tag to Remove from Post:
                </label>
                {currentTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {currentTags.map((t) => {
                      const isSelected = content === t.name;
                      return (
                        <button
                          key={t.id || t.name}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setContent(t.name)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-rose-500/20 border-rose-500 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                              : "bg-[#151f2e] border-[#27364b] hover:border-rose-500/50 text-[#bcbedc]"
                          }`}
                        >
                          <span>🏷️ {t.name}</span>
                          {isSelected && <span className="text-xs">✕</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-amber-400/90 bg-amber-400/10 p-3 rounded-xl border border-amber-400/20">
                    This post currently has no character tags to remove.
                  </div>
                )}
              </div>
            )}

            {/* REPLACE TAG */}
            {type === "REPLACE_TAG" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#8ba0b2] mb-2">
                    1. Select Tag to Replace:
                  </label>
                  {currentTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {currentTags.map((t) => {
                        const isSelected = selectedOldTag === t.name;
                        return (
                          <button
                            key={t.id || t.name}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setSelectedOldTag(t.name)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                                : "bg-[#151f2e] border-[#27364b] hover:border-amber-500/50 text-[#bcbedc]"
                            }`}
                          >
                            🏷️ {t.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-400/90 bg-amber-400/10 p-3 rounded-xl border border-amber-400/20">
                      This post currently has no tags to replace.
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8ba0b2] mb-1.5">
                    2. Correct Replacement Character:
                  </label>
                  <div ref={charDropdownRef} className="relative">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setIsCharMenuOpen((prev) => !prev)}
                      className="w-full bg-[#151f2e] border border-[#27364b] focus:border-[#3db4f2] text-xs text-left text-white rounded-xl px-3.5 py-3 flex items-center justify-between transition cursor-pointer disabled:opacity-50"
                    >
                      <span
                        className={
                          content ? "text-white font-medium" : "text-[#5a6f82]"
                        }
                      >
                        {content || "-- Choose replacement character --"}
                      </span>
                      <span className="text-[#8ba0b2] text-[10px] ml-2">
                        {isCharMenuOpen ? "▲" : "▼"}
                      </span>
                    </button>

                    {isCharMenuOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0e1b2a] border border-[#27364b] rounded-xl shadow-2xl z-60 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-[#1e2d42] bg-[#132032]">
                          <input
                            type="text"
                            autoFocus
                            value={charSearch}
                            onChange={(e) => setCharSearch(e.target.value)}
                            placeholder="Type to filter (e.g. Spe, Suzuka, スペ)..."
                            className="w-full bg-[#182638] border border-[#2b3c52] focus:border-[#3db4f2] text-xs text-white placeholder-[#5a6f82] rounded-lg px-2.5 py-1.5 focus:outline-none transition"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-[#1e2d42]/50">
                          {filteredCharacters.length > 0 ? (
                            filteredCharacters.map((char) => (
                              <button
                                type="button"
                                key={char.slug}
                                onClick={() => {
                                  setContent(char.name);
                                  setIsCharMenuOpen(false);
                                  setCharSearch("");
                                }}
                                className={`w-full text-left px-3 py-2 text-xs transition cursor-pointer flex items-center justify-between hover:bg-[#1a2b40] ${
                                  content === char.name
                                    ? "bg-[#1f3652] text-[#3db4f2] font-semibold"
                                    : "text-zinc-200"
                                }`}
                              >
                                <span>{char.name}</span>
                                <span className="text-[11px] text-[#8ba0b2]">
                                  {char.jp}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-center text-xs text-[#5a6f82]">
                              No character matched &quot;{charSearch}&quot;
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ORIGINAL LINK */}
            {type === "ORIGINAL_LINK" && (
              <div>
                <label className="block text-xs font-medium text-[#8ba0b2] mb-1.5">
                  Original Tweet Link (X.com):
                </label>
                <input
                  type="url"
                  required
                  disabled={isSubmitting}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="https://x.com/artist/status/1845..."
                  className="w-full bg-[#151f2e] border border-[#27364b] focus:border-[#3db4f2] text-xs text-white placeholder-[#5a6f82] rounded-xl px-3.5 py-3 focus:outline-none transition disabled:opacity-50"
                />
              </div>
            )}

            {/* BROKEN MEDIA / OTHER */}
            {(type === "BROKEN_MEDIA" || type === "OTHER") && (
              <div>
                <label className="block text-xs font-medium text-[#8ba0b2] mb-1.5">
                  {type === "BROKEN_MEDIA"
                    ? "Describe Image Issue:"
                    : "Details / Feedback:"}
                </label>
                <textarea
                  required
                  rows={3}
                  disabled={isSubmitting}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    type === "BROKEN_MEDIA"
                      ? "Describe which image is broken or missing..."
                      : "Enter details here..."
                  }
                  className="w-full bg-[#151f2e] border border-[#27364b] focus:border-[#3db4f2] text-xs text-white placeholder-[#5a6f82] rounded-xl p-3 focus:outline-none transition disabled:opacity-50 resize-none"
                />
              </div>
            )}
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                statusMessage.isError
                  ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                  : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1e2d42]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl bg-[#151f2e] hover:bg-[#1e2d42] border border-[#27364b] text-xs text-gray-300 transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid()}
              className="px-5 py-2.5 rounded-xl bg-[#3db4f2] hover:bg-[#3db4f2]/80 text-black text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(61,180,242,0.3)] disabled:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Report</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#151f2e] hover:bg-[#1f2d42] border border-[#27364b] hover:border-[#3db4f2]/60 text-[11px] text-[#8ba0b2] hover:text-[#3db4f2] transition group cursor-pointer active:scale-95"
        title="Report issue"
      >
        <svg
          className="w-3.5 h-3.5 text-[#8ba0b2] group-hover:text-[#3db4f2] transition"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
          />
        </svg>
        <span>Report</span>
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(modalContent, document.body)
        : null}
    </>
  );
}
