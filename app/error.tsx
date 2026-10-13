"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#0b1622] flex flex-col items-center justify-center text-center px-4">
      <h2 className="text-xl font-bold text-white mb-2">
        Something went wrong!
      </h2>
      <p className="text-sm text-[#8ba0b2] mb-4">
        Failed to load comics. Please try again.
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-[#3db4f2] text-white rounded-lg text-xs font-semibold hover:bg-[#3db4f2]/80 transition"
      >
        Try Again
      </button>
    </div>
  );
}
