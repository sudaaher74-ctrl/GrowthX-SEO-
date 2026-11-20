"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { auth, subscribeToAuthChange } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const DOMAIN_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function normalizeDomainInput(raw: string): { valid: boolean; normalized: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, normalized: "" };
  if (/\s/.test(trimmed)) return { valid: false, normalized: "" };

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (!DOMAIN_PATTERN.test(host)) return { valid: false, normalized: "" };
    return { valid: true, normalized: host };
  } catch {
    return { valid: false, normalized: "" };
  }
}

interface DomainAuditFormProps {
  buttonLabel?: string;
  className?: string;
  inputContainerClassName?: string;
}

export function DomainAuditForm({
  buttonLabel = "Run free audit",
  className,
  inputContainerClassName,
}: DomainAuditFormProps) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const signedIn = useSyncExternalStore(
    subscribeToAuthChange,
    () => auth.isAuthenticated(),
    () => false,
  );

  const check = normalizeDomainInput(value);
  const showError = touched && value.trim().length > 0 && !check.valid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();

    if (trimmed.length > 0 && !check.valid) {
      setTouched(true);
      inputRef.current?.focus();
      return;
    }

    if (check.normalized) {
      try {
        localStorage.setItem("growthx_pending_domain", check.normalized);
      } catch {}
    }

    const clean = check.normalized ? encodeURIComponent(check.normalized) : "";
    window.location.href = signedIn
      ? clean
        ? `/analyze?url=${clean}`
        : "/analyze"
      : clean
        ? `/login?url=${clean}`
        : "/login";
  };

  return (
    <form onSubmit={handleSubmit} noValidate className={cn("w-full", className)}>
      <div
        className={cn(
          "flex flex-col sm:flex-row items-stretch gap-2 p-1.5 rounded-2xl transition-all",
          showError
            ? "border border-error-500 bg-surface-1 shadow-card"
            : inputContainerClassName ??
                "bg-surface-1 border border-brand-200 focus-within:border-brand-400 shadow-card",
        )}
      >
        <label htmlFor={inputId} className="sr-only">
          Website domain to audit
        </label>
        <input
          ref={inputRef}
          id={inputId}
          name="url"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (value.trim().length > 0) setTouched(true);
          }}
          placeholder="yourwebsite.com"
          aria-invalid={showError ? "true" : "false"}
          aria-describedby={showError ? errorId : undefined}
          className="flex-1 bg-transparent px-3.5 sm:px-4 py-2.5 text-sm font-medium text-brand-950 placeholder-brand-400 outline-none focus:outline-none focus:ring-0"
          style={{ outline: "none", boxShadow: "none" }}
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 bg-signal-400 hover:bg-signal-500 active:scale-[0.98] text-signal-ink font-extrabold text-sm px-5 sm:px-6 py-2.5 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <span>{buttonLabel}</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {showError && (
        <p
          id={errorId}
          className="mt-2 flex items-center gap-1.5 px-1 text-xs font-medium text-error-600"
        >
          <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
          <span>Error: Enter a valid website domain like yourwebsite.com.</span>
        </p>
      )}
    </form>
  );
}
