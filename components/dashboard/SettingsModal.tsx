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
              Offer Price (paise)
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
              In paise (e.g. 499 = ₹4.99). Default: 499
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
              Message sent with the payment link. Use {"{link}"} for the payment URL.
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

        <div className="mt-6 flex justify-end gap-3">
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
