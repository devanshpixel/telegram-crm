import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { RevenueBadge } from "@/components/ui/RevenueBadge";
import type { ContactProfile } from "@/types";
import { Mail, MapPin, Calendar, MessageSquare, ShoppingBag, Clock, Tag } from "lucide-react";
import { formatTime } from "@/lib/utils";

interface ProfileSectionProps {
  profile: ContactProfile;
  totalMessages?: number;
}

export function ProfileSection({ profile, totalMessages }: ProfileSectionProps) {
  return (
    <section className="border-b border-border px-5 py-6 text-center">
      <Avatar
        initials={profile.avatar}
        colorClass={profile.avatarColor}
        size="xl"
        isOnline={profile.isOnline}
        className="mx-auto"
      />

      <h2 className="mt-4 text-lg font-semibold tracking-tight">{profile.name}</h2>
      <p className="mt-0.5 text-sm text-accent">{profile.username}</p>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <RevenueBadge amount={profile.revenue} size="md" />
        {profile.isOnline ? (
          <Badge variant="success" className="gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Online
          </Badge>
        ) : (
          <Badge variant="default">{profile.lastActivity ? formatTime(profile.lastActivity) : "Inactive"}</Badge>
        )}
      </div>

      <dl className="mt-6 space-y-2 text-left">
        <div className="flex items-center gap-2.5 rounded-lg bg-surface-card/50 px-3 py-2 border border-border/50">
          <Clock className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-[11px] text-text-muted">Last msg:</span>
          <span className="ml-auto text-[11px] font-medium text-text-secondary">{profile.lastActivity ? formatTime(profile.lastActivity) : "None"}</span>
        </div>
        
        <div className="flex items-center gap-2.5 rounded-lg bg-surface-card/50 px-3 py-2 border border-border/50">
          <MessageSquare className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-[11px] text-text-muted">Total messages:</span>
          <span className="ml-auto text-[11px] font-medium text-text-secondary">{totalMessages ?? "..."}</span>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg bg-surface-card/50 px-3 py-2 border border-border/50">
          <ShoppingBag className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-[11px] text-text-muted">Last purchase:</span>
          <span className="ml-auto text-[11px] font-medium text-text-secondary">{profile.lastPurchaseDate ? formatTime(profile.lastPurchaseDate) : "None"}</span>
        </div>

        {profile.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {profile.tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent border border-accent/20">
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </dl>

      <dl className="mt-6 space-y-3 text-left border-t border-border pt-6">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="truncate text-sm text-text-secondary">{profile.email || "No email"}</span>
        </div>
        <div className="flex items-center gap-3">
          <MapPin className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="text-sm text-text-secondary">{profile.location || "No location"}</span>
        </div>
      </dl>

      <p className="mt-6 text-[11px] text-text-muted flex items-center justify-center gap-1.5">
        <Calendar className="h-3 w-3" />
        Fan since {profile.joinedAt}
      </p>
    </section>
  );
}

