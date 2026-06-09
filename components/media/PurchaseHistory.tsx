"use client";

import { ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Purchase } from "@/types";

interface PurchaseHistoryProps {
  purchases: Purchase[];
  limit?: number;
}

export function PurchaseHistory({ purchases, limit = 5 }: PurchaseHistoryProps) {
  const items = purchases.slice(0, limit);

  return (
    <section className="border-b border-border px-5 py-5">
      <div className="mb-3 flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-revenue" />
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          Purchase history
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-text-muted">No purchases yet</p>
      ) : (
        <ol className="space-y-2">
          {items.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-card px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-revenue">
                  {formatCurrency(p.amount)}
                </p>
                <p className="text-[11px] text-text-muted">
                  {p.purchaseDate} · {p.kind}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
