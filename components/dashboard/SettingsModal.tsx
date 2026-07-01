"use client";

import { useCallback, useEffect, useState } from "react";

interface Settings {
  offerPrice: number;
  offerMessage: string;
  aiMode: "auto" | "casual" | "flirty" | "sales" | "premium";
  automatedReplies: boolean;
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* clear cookie best-effort; reload lands on the 401 sign-in page anyway */
    } finally {
      // Full reload so middleware re-evaluates auth and serves the sign-in page.
      window.location.href = "/";
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) setSettings(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const save = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      onClose();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }, [settings, onClose]);

  if (!open || !settings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">&times;</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Offer Price (₹)
            </label>
            <input
              type="number"
              value={settings.offerPrice}
              onChange={(e) =>
                setSettings({ ...settings, offerPrice: parseInt(e.target.value, 10) || 0 })
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
            <p className="mt-1 text-xs text-gray-500">
              In rupees (e.g. 499 = ₹499). Default: 499. First-timers get 70% of this.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Offer Message
            </label>
            <textarea
              value={settings.offerMessage}
              onChange={(e) =>
                setSettings({ ...settings, offerMessage: e.target.value })
              }
              rows={4}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
            <p className="mt-1 text-xs text-gray-500">
              Message sent before the payment link.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              AI Reply Mode
            </label>
            <select
              value={settings.aiMode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  aiMode: e.target.value as Settings["aiMode"],
                })
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="auto">Auto-detect</option>
              <option value="casual">Casual</option>
              <option value="flirty">Flirty</option>
              <option value="sales">Sales</option>
              <option value="premium">Premium Upsell</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="automatedReplies"
              checked={settings.automatedReplies}
              onChange={(e) =>
                setSettings({ ...settings, automatedReplies: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="automatedReplies" className="text-sm text-gray-700 dark:text-gray-300">
              Enable automated AI replies
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={logout}
            disabled={loggingOut}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
