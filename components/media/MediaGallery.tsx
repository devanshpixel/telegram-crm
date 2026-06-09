"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Image, Loader2, Lock, Unlock } from "lucide-react";
import { createMediaUnlockCheckoutSession, fetchContact, fetchContactMedia } from "@/lib/api";
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

  const isImage = media.mimeType.startsWith("image/");
  const date = new Date(media.createdAt);
  const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  async function handleUnlock() {
    setCheckingOut(true);
    try {
      const { sessionUrl } = await createMediaUnlockCheckoutSession(contactId, Number(media.id), media.price);
      window.location.href = sessionUrl;
    } catch {
      setCheckingOut(false);
    }
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
          <span className="text-xs font-semibold">{formatCurrency(media.price)}</span>
          {media.price > 0 ? (
            <Lock className="h-3 w-3 text-amber-400" />
          ) : (
            <Unlock className="h-3 w-3 text-emerald-400" />
          )}
        </div>
        <p className="text-[10px] text-text-muted">{formattedDate}</p>
        {media.price > 0 && (
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
            Unlock for {formatCurrency(media.price)}
          </button>
        )}
      </div>
    </div>
  );
}


