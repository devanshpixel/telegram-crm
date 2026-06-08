"use client";

import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { telegramSendCode, telegramVerifyCode, telegramVerifyPassword } from "@/lib/api";

type LoginStep = "phone" | "code" | "password";

interface TelegramLoginModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function TelegramLoginModal({
  open,
  onClose,
  onAuthenticated,
}: TelegramLoginModalProps) {
  const [step, setStep] = useState<LoginStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setStep("phone");
    setPhone("");
    setCode("");
    setPassword("");
    setLoading(false);
    setError("");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  if (!open) return null;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await telegramSendCode(phone.trim());
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await telegramVerifyCode(phone.trim(), code.trim());
      if ("needs2fa" in result && result.needs2fa) {
        setStep("password");
        return;
      }
      onAuthenticated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await telegramVerifyPassword(password);
      onAuthenticated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface-raised p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Connect Telegram</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "phone" && (
          <form onSubmit={handleSendCode} className="space-y-3">
            <Field label="Phone number" required>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className={inputClass}
                placeholder="+1234567890"
                autoFocus
              />
            </Field>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm text-text-secondary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send code"}
              </button>
            </div>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <Field label="Verification code" required>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className={inputClass}
                placeholder="12345"
                autoFocus
              />
            </Field>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <button
              type="button"
              onClick={() => setStep("phone")}
              className="text-xs text-accent hover:underline"
            >
              &larr; Back to phone number
            </button>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm text-text-secondary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify code"}
              </button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handleVerifyPassword} className="space-y-3">
            <p className="text-xs text-text-muted">
              Two-factor authentication is enabled. Enter your password.
            </p>

            <Field label="2FA password" required>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
                placeholder="Enter your Telegram password"
                autoFocus
              />
            </Field>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <button
              type="button"
              onClick={() => setStep("code")}
              className="text-xs text-accent hover:underline"
            >
              &larr; Back to code
            </button>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm text-text-secondary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>
        )}
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
