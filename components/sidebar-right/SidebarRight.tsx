import { X, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { ContactProfile } from "@/types";
import { MediaGallery } from "@/components/media/MediaGallery";
import { UploadMediaForm } from "@/components/media/UploadMediaForm";
import { PurchaseHistory } from "@/components/media/PurchaseHistory";
import { LeadScoreSection } from "./LeadScoreSection";
import { NotesSection } from "./NotesSection";
import { PpvSection } from "./PpvSection";
import { ProfileSection } from "./ProfileSection";
import { RevenueSection } from "./RevenueSection";
import { TagsSection } from "./TagsSection";
import { TimelineSection } from "./TimelineSection";

interface SidebarRightProps {
  profile: ContactProfile;
  totalMessages?: number;
  onClose?: () => void;
  onAddNote: (content: string) => Promise<void>;
  onAddTag: (name: string) => Promise<void>;
  onDeleteTag: (name: string) => Promise<void>;
  onDeleteContact: () => Promise<void>;
}

export function SidebarRight({
  profile,
  totalMessages,
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
        <ProfileSection profile={profile} totalMessages={totalMessages} />
        <RevenueSection profile={profile} />

        <PpvSection profile={profile} />
        <PurchaseHistory purchases={profile.purchases ?? []} />
        <MediaGallery key={profile.id} contactId={Number(profile.id)} />
        <UploadMediaForm contactId={Number(profile.id)} />
        <TagsSection profile={profile} onAddTag={onAddTag} onDeleteTag={onDeleteTag} />
        <NotesSection profile={profile} onSaveNote={onAddNote} />
        <LeadScoreSection profile={profile} />
        <TimelineSection contactId={profile.id} />
      </div>
    </aside>
  );
}


