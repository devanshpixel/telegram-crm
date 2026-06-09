"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Image, Loader2, Lock, Pencil, Unlock, X, Check } from "lucide-react";
import { createMediaUnlockCheckoutSession, fetchContact, fetchContactMedia, updateMediaPriceApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { PurchaseHistory } from "./PurchaseHistory";
import type { Media, Purchase } from "@/types";

interface MediaGalleryProps {
  contactId: number;
}

export function MediaGallery({ contactId }: MediaGalleryProps) {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchContactMedia(contactId),
      fetchContact(String(contactId)),
    ])
      .then(([items, profile]) => { if (!cancelled) { setMedia(items); setPurchases((profile as { purchases?: Purchase[] }).purchases ?? []); } })
      .catch(() => { if (!cancelled) { setMedia([]); setPurchases([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contactId]);

  if (loading) {
    return (
      <section className="border-b border-border px-5 py-5">
        <div className="mb-3 flex items-center gap-2">
          <Image className="h-4 w-4 text-text-muted" />
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Media</h3>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-text-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading...
        </p>
      </section>
    );
  }

  if (media.length === 0) {
    return (
      <section className="border-b border-border px-5 py-5">
        <div className="mb-3 flex items-center gap-2">
          <Image className="h-4 w-4 text-text-muted" />
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Media</h3>
        </div>
        <p className="text-xs text-text-muted">No media yet</p>
      </section>
    );
  }

  return (
    <>
      <section className="border-b border-border px-5 py-5">
        <div className="mb-3 flex items-center gap-2">
          <Image className="h-4 w-4 text-accent" />
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Media</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {media.map((item) => (
            <MediaCard key={item.id} media={item} contactId={contactId} />
          ))}
        </div>
      </section>
      <PurchaseHistory purchases={purchases} />
    </>
  );
}

function MediaCard({ media, contactId }: { media: Media; contactId: number }) {
  const [checkingOut, setCheckingOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editPrice, setEditPrice] = useState(String(media.price));
  const [currentPrice, setCurrentPrice] = useState(media.price);

  const isImage = media.mimeType.startsWith("image/");
  const date = new Date(media.createdAt);
  const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  async function handleUnlock() {
    setCheckingOut(true);
    try {
      const { sessionUrl } = await createMediaUnlockCheckoutSession(contactId, Number(media.id), currentPrice);
      window.location.href = sessionUrl;
    } catch {
      setCheckingOut(false);
    }
  }

  async function handleSavePrice() {
    const val = parseFloat(editPrice);
    if (isNaN(val) || val < 0) return;
    try {
      await updateMediaPriceApi(media.id, val);
      setCurrentPrice(val);
      setEditing(false);
    } catch {
      // revert
    }
  }

  function handleCancelPrice() {
    setEditPrice(String(currentPrice));
    setEditing(false);
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-surface-card">
      <div className="aspect-square overflow-hidden bg-surface-hover">
        {isImage ? (
          <img
            src={`/api/media/${media.id}/preview?contactId=${contactId}`}
            alt={media.originalName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-[11px] font-medium text-text-muted">{media.originalName}</span>
          </div>
        )}
      </div>
      <div className="space-y-1 p-2">
        <div className="flex items-center justify-between">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-16 rounded border border-border bg-surface-card px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                autoFocus
              />
              <button onClick={() => void handleSavePrice()} className="text-emerald-400 hover:text-emerald-300">
                <Check className="h-3 w-3" />
              </button>
              <button onClick={handleCancelPrice} className="text-rose-400 hover:text-rose-300">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <>
              <span className="text-xs font-semibold">{formatCurrency(currentPrice)}</span>
              <div className="flex items-center gap-1">
                {currentPrice > 0 ? (
                  <Lock className="h-3 w-3 text-amber-400" />
                ) : (
                  <Unlock className="h-3 w-3 text-emerald-400" />
                )}
                <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition-opacity">
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            </>
          )}
        </div>
        <p className="text-[10px] text-text-muted">{formattedDate}</p>
        {currentPrice > 0 && !editing && (
          <button
            onClick={() => void handleUnlock()}
            disabled={checkingOut}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-2 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {checkingOut ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ExternalLink className="h-3 w-3" />
            )}
            Unlock for {formatCurrency(currentPrice)}
          </button>
        )}
      </div>
    </div>
  );
}


