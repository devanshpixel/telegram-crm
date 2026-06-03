"use client";

import { Mic, Paperclip, Send, Smile } from "lucide-react";
import { useState } from "react";

interface MessageInputProps {
  contactName: string;
  onSend: (text: string) => Promise<void>;
}

export function MessageInput({ contactName, onSend }: MessageInputProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSend(text);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="safe-bottom shrink-0 border-t border-border bg-surface-raised px-3 py-3 sm:px-4">
      <div className="mx-auto flex max-w-3xl items-end gap-1.5 rounded-2xl border border-border bg-surface-card px-2 py-1.5 focus-within:border-border-focus focus-within:ring-1 focus-within:ring-accent/20 sm:gap-2 sm:px-3 sm:py-2">
        <button
          type="button"
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-muted transition hover:bg-surface-hover hover:text-text-secondary"
          aria-label="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <textarea
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Message ${contactName}...`}
          disabled={sending}
          className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50"
        />
        <button
          type="button"
          className="mb-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-muted transition hover:bg-surface-hover sm:flex"
          aria-label="Emoji"
        >
          <Smile className="h-5 w-5" />
        </button>
        {draft.trim() ? (
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-telegram text-white transition hover:opacity-90 disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-muted transition hover:bg-surface-hover"
            aria-label="Voice message"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
