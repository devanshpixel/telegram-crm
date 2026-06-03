"use client";

import { Search, SlidersHorizontal } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="flex gap-2 px-4 pb-3 pt-1">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          placeholder="Search fans..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface-card py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted outline-none transition focus:border-border-focus focus:ring-1 focus:ring-accent/30"
        />
      </div>
      <button
        type="button"
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface-card text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
        aria-label="Filter chats"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}
