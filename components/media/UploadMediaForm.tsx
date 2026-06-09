"use client";

import { useRef, useState } from "react";
import { Image, Loader2, Upload } from "lucide-react";
import { uploadMedia } from "@/lib/api";

interface UploadMediaFormProps {
  contactId: number;
}

export function UploadMediaForm({ contactId }: UploadMediaFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [price, setPrice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const priceVal = price ? parseFloat(price) : 0;
      await uploadMedia(contactId, file, isNaN(priceVal) ? 0 : priceVal);
      setFile(null);
      setPrice("");
      setDone(true);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      // upload failed
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <section className="border-b border-border px-5 py-5">
        <div className="mb-3 flex items-center gap-2">
          <Image className="h-4 w-4 text-text-muted" />
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Upload media</h3>
        </div>
        <p className="text-xs text-text-muted">Media uploaded.</p>
      </section>
    );
  }

  return (
    <section className="border-b border-border px-5 py-5">
      <div className="mb-3 flex items-center gap-2">
        <Upload className="h-4 w-4 text-text-muted" />
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Upload media</h3>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs text-text-secondary file:mr-2 file:rounded-lg file:border-0 file:bg-accent/10 file:px-2 file:py-1 file:text-[11px] file:font-medium file:text-accent"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Price (0 = free)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </form>
    </section>
  );
}
