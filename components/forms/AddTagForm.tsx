"use client";

import { useState } from "react";

interface AddTagFormProps {
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}

export function AddTagForm({ onSubmit, onCancel }: AddTagFormProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onSubmit(name.trim());
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tag");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tag name..."
        className="w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-border-focus focus:ring-1 focus:ring-accent/20"
        autoFocus
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-border py-1.5 text-xs text-text-muted hover:bg-surface-hover"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="flex-1 rounded-lg bg-accent py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading ? "Saving..." : "Add tag"}
        </button>
      </div>
    </form>
  );
}
