"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { AddTagForm } from "@/components/forms/AddTagForm";
import type { ContactProfile } from "@/types";
import { Plus, Tag } from "lucide-react";

interface TagsSectionProps {
  profile: ContactProfile;
  onAddTag: (name: string) => Promise<void>;
}

function tagVariant(
  tag: string,
): "default" | "accent" | "success" | "warning" | "revenue" {
  if (tag === "Whale" || tag === "VIP") return "revenue";
  if (tag === "Subscriber" || tag === "PPV Buyer" || tag === "Active") return "success";
  if (tag === "New Lead" || tag === "Trial") return "warning";
  return "default";
}

export function TagsSection({ profile, onAddTag }: TagsSectionProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="border-b border-border px-5 py-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-accent" />
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
            Tags
          </h3>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-accent transition hover:bg-accent-glow"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {profile.tags.map((tag) => (
          <Badge key={tag} variant={tagVariant(tag)}>
            {tag}
          </Badge>
        ))}
      </div>
      {showForm && (
        <AddTagForm
          onSubmit={async (name) => {
            await onAddTag(name);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </section>
  );
}
