"use client";

import { StickyNote } from "lucide-react";
import { useEffect, useState } from "react";
import type { ContactProfile } from "@/types";

interface NotesSectionProps {
  profile: ContactProfile;
  onSaveNote: (content: string) => Promise<void>;
}

export function NotesSection({ profile, onSaveNote }: NotesSectionProps) {
  const [notes, setNotes] = useState(profile.notes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNotes(profile.notes);
  }, [profile.id, profile.notes]);

  const handleSave = async () => {
    if (!notes.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await onSaveNote(notes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-b border-border px-5 py-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-accent" />
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
            Internal notes
          </h3>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !notes.trim()}
          className="rounded-lg px-2 py-1 text-xs font-medium text-accent transition hover:bg-accent-glow disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved" : "Save note"}
        </button>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        className="w-full resize-none rounded-xl border border-border bg-surface-card px-3.5 py-3 text-sm leading-relaxed text-text-primary outline-none transition placeholder:text-text-muted focus:border-border-focus focus:ring-1 focus:ring-accent/20"
        placeholder="Add notes about this fan..."
      />
    </section>
  );
}
