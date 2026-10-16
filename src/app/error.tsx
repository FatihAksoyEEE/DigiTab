'use client';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1120]">
      <div className="text-center p-8 rounded-2xl bg-slate-800/50 border border-red-500/30 max-w-md">
        <h2 className="text-2xl font-bold text-red-400 mb-4">Bir Hata Oluştu</h2>
        <p className="text-slate-400 mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
