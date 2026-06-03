import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { RevenueBadge } from "@/components/ui/RevenueBadge";
import type { ContactProfile } from "@/types";
import { Mail, MapPin } from "lucide-react";

interface ProfileSectionProps {
  profile: ContactProfile;
}

export function ProfileSection({ profile }: ProfileSectionProps) {
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
          <Badge variant="default">{profile.lastActivity}</Badge>
        )}
      </div>

      {profile.ppvCount !== undefined && profile.ppvCount > 0 && (
        <p className="mt-3 text-xs text-text-muted">
          <span className="font-medium text-text-secondary">{profile.ppvCount}</span>{" "}
          PPVs purchased
        </p>
      )}

      <dl className="mt-6 space-y-3 text-left">
        <div className="flex items-center gap-3 rounded-xl bg-surface-card px-3 py-2.5 ring-1 ring-border">
          <Mail className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="truncate text-sm text-text-secondary">{profile.email}</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-surface-card px-3 py-2.5 ring-1 ring-border">
          <MapPin className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="text-sm text-text-secondary">{profile.location}</span>
        </div>
      </dl>

      <p className="mt-4 text-[11px] text-text-muted">
        Fan since {profile.joinedAt}
      </p>
    </section>
  );
}
