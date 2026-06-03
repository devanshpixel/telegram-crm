"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createContactApi } from "@/lib/api";
import type { ContactProfile } from "@/types";

interface CreateContactModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (profile: ContactProfile) => void;
}

export function CreateContactModal({
  open,
  onClose,
  onCreated,
}: CreateContactModalProps) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [revenue, setRevenue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const profile = await createContactApi({
        name: name.trim(),
        username: username.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        revenue: revenue ? Number(revenue) : undefined,
      });
      onCreated(profile);
      setName("");
      setUsername("");
      setEmail("");
      setPhone("");
      setRevenue("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contact");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface-raised p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">New contact</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
              placeholder="Elena Vasquez"
            />
          </Field>
          <Field label="Username" required>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className={inputClass}
              placeholder="@elena_v"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Revenue ($)">
            <input
              type="number"
              min={0}
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              className={inputClass}
            />
          </Field>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm text-text-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-text-muted">
        {label}
        {required && <span className="text-rose-400"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-sm text-text-primary outline-none focus:border-border-focus focus:ring-1 focus:ring-accent/20";
