import { X, Trash2, ShoppingCart } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { formatCurrency } from "@/lib/utils";
import type { ContactProfile, Purchase } from "@/types";
import { LeadScoreSection } from "./LeadScoreSection";
import { NotesSection } from "./NotesSection";
import { PpvSection } from "./PpvSection";
import { ProfileSection } from "./ProfileSection";
import { RevenueSection } from "./RevenueSection";
import { TagsSection } from "./TagsSection";
import { TimelineSection } from "./TimelineSection";

interface SidebarRightProps {
  profile: ContactProfile;
  onClose?: () => void;
  onAddNote: (content: string) => Promise<void>;
  onAddTag: (name: string) => Promise<void>;
  onDeleteTag: (name: string) => Promise<void>;
  onDeleteContact: () => Promise<void>;
}

export function SidebarRight({
  profile,
  onClose,
  onAddNote,
  onAddTag,
  onDeleteTag,
  onDeleteContact,
}: SidebarRightProps) {
  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-surface-raised">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5">
        <h2 className="text-sm font-semibold">Fan details</h2>
        <div className="flex items-center gap-1">
          <IconButton
            onClick={() => void onDeleteContact()}
            aria-label="Delete contact"
            className="text-rose-400 hover:text-rose-300"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </IconButton>
          {onClose && (
            <IconButton onClick={onClose} aria-label="Close panel">
              <X className="h-[18px] w-[18px]" />
            </IconButton>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <ProfileSection profile={profile} />
        <RevenueSection profile={profile} />
        <PpvSection profile={profile} />
        <PurchaseHistorySection purchases={profile.purchases ?? []} />
        <TagsSection profile={profile} onAddTag={onAddTag} onDeleteTag={onDeleteTag} />
        <NotesSection profile={profile} onSaveNote={onAddNote} />
        <LeadScoreSection profile={profile} />
        <TimelineSection contactId={profile.id} />
      </div>
    </aside>
  );
}

function PurchaseHistorySection({ purchases }: { purchases: Purchase[] }) {
  const recent = purchases.slice(0, 5);
  return (
    <section className="border-b border-border px-5 py-5">
      <div className="mb-3 flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-revenue" />
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          Purchase history
        </h3>
      </div>
      {recent.length === 0 ? (
        <p className="text-xs text-text-muted">No purchases yet</p>
      ) : (
        <ol className="space-y-2">
          {recent.map((p) => (
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
