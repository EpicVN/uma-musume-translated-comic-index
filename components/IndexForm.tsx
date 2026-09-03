'use client';

import { useState } from 'react';

export default function IndexForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch('/api/index-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origUrl: formData.get('origUrl'),
          transUrl: formData.get('transUrl'),
          language: formData.get('language'),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra');

      form.reset();
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative rounded-2xl p-px bg-linear-to-b from-zinc-700 via-zinc-800 to-zinc-900 shadow-2xl mb-12">
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-950/90 backdrop-blur-xl p-6 sm:p-8 rounded-[15px] flex flex-col gap-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">Tweet bài gốc (Raw)</label>
            <input
              name="origUrl"
              type="url"
              placeholder="https://x.com/artist/status/..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">Tweet bài dịch (Translated)</label>
            <input
              name="transUrl"
              type="url"
              placeholder="https://x.com/translator/status/..."
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-800/60">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-400">Ngôn ngữ:</span>
            <select
              name="language"
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-medium focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              <option value="en">English (EN)</option>
              <option value="vi">Tiếng Việt (VI)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 text-xs font-semibold tracking-wide transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-zinc-950" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Đang xử lý...</span>
              </>
            ) : (
              'Lưu & Liên kết'
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400 text-xs">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}