"use client";

import type { ReplyMode } from "@/types";
import { Mic, Paperclip, Send, Smile, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { suggestReplyApi } from "@/lib/api";

interface MessageInputProps {
  contactName: string;
  contactId: string;
  onSend: (text: string) => Promise<void>;
}

const MODE_OPTIONS: { value: ReplyMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "casual", label: "Casual" },
  { value: "flirty", label: "Flirty" },
  { value: "sales", label: "Sales" },
  { value: "reengagement", label: "Re-engage" },
];

export function MessageInput({ contactName, contactId, onSend }: MessageInputProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<ReplyMode>("auto");
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    setSuggestion("");
    suggestReplyApi(Number(contactId), mode)
      .then(({ suggestion: s }) => setSuggestion(s))
      .catch(() => {});
  }, [contactId]);

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setError("");
    try {
      const { suggestion } = await suggestReplyApi(Number(contactId), mode);
      setDraft(suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate reply");
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      await onSend(text);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
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

  const handleSendSuggestion = async () => {
    const text = suggestion;
    setSuggestion("");
    await onSend(text);
  };

  return (
    <div className="safe-bottom shrink-0 border-t border-border bg-surface-raised px-3 py-3 sm:px-4">
      {suggestion && (
        <div className="mb-2 rounded-xl border border-border bg-surface-card px-3 py-2.5">
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            <Sparkles className="h-3 w-3" /> Suggested Reply
          </p>
          <p className="mb-2 line-clamp-2 text-sm text-text-primary">{suggestion}</p>
          <button
            type="button"
            onClick={() => void handleSendSuggestion()}
            disabled={sending}
            className="rounded-lg bg-telegram px-3 py-1 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
      {error && (
        <p className="mb-1.5 text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}
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
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={onKeyDown}
          placeholder={`Message ${contactName}...`}
          disabled={sending}
          className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50"
        />
        <div className="mb-0.5 hidden items-center gap-0.5 sm:flex">
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-muted transition hover:bg-surface-hover disabled:opacity-40"
            aria-label="Generate reply"
            disabled={generating}
            onClick={() => void handleGenerate()}
          >
            <Sparkles className={"h-5 w-5" + (generating ? " animate-pulse" : "")} />
          </button>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ReplyMode)}
            className="h-6 rounded border border-border bg-surface-card px-1 text-[11px] text-text-secondary outline-none"
          >
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
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
