"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center bg-black p-4 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-surface-raised p-6 shadow-panel">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
          <p className="mt-2 text-sm text-text-muted">
            {error.message || "An unexpected error occurred in the application."}
          </p>
        </div>
        <div className="mt-2 flex w-full gap-3">
          <button
            onClick={() => window.location.href = "/"}
            className="flex flex-1 items-center justify-center rounded-xl border border-border bg-surface-card px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
          >
            Go to home
          </button>
          <button
            onClick={() => reset()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
