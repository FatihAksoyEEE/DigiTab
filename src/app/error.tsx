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
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="card text-center p-8 rounded-2xl border-danger/30 max-w-md">
        <h2 className="text-2xl font-bold text-danger-ink mb-4">Bir Hata Oluştu</h2>
        <p className="mb-6" style={{ color: "var(--text-secondary)" }}>{error.message}</p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-accent hover:bg-accent-hover text-accent-fg rounded-lg transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
