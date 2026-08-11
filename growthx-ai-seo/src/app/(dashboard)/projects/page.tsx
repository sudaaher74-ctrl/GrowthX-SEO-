"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Globe, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateProject, useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";

/**
 * The "Add client" flow linked from /clients. Creates the Project first, then
 * registers the website against it — a website with no projectId never shows
 * up in the portfolio, so the two calls have to happen in this order.
 */
export default function AddClientPage() {
  const router = useRouter();
  const { orgId, setProjectId } = useWorkspace();
  const createProject = useCreateProject(orgId);
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<"idle" | "creating" | "registering" | "verifying">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim() || !orgId) return;
    setError("");

    let domain = url.trim().toLowerCase();
    try {
      domain = domain.startsWith("http://") || domain.startsWith("https://") ? new URL(domain).hostname : domain;
    } catch {
      // keep the raw input; validated below
    }
    domain = domain.replace(/^www\./, "");
    if (!domain.includes(".")) {
      setError("Enter a valid domain name (e.g. example.com)");
      return;
    }

    try {
      setStep("creating");
      const project = await createProject.mutateAsync(name.trim());
      setProjectId(project.id);

      setStep("registering");
      const website = await api.registerWebsite(url.trim(), domain, project.id);

      setStep("verifying");
      await api.verifyDomain(website.id);

      // Important: the project was created, but now we've added a website to it.
      // We must invalidate the portfolio so the technical SEO page gets fresh data
      // where the client has a domain.
      await qc.invalidateQueries({ queryKey: ["portfolio", orgId] });

      router.push(`/technical-seo?domain=${encodeURIComponent(domain)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add client");
      setStep("idle");
    }
  }

  const busy = step !== "idle";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={14} /> Back to clients
      </Link>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-h1 text-[var(--text-primary)]">Add a client</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Creates the client record and registers their website so it starts showing up in your portfolio.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">Client name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc."
            disabled={busy}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">Website URL</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={busy}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] py-2.5 pl-9 pr-3.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-3.5">
          <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" /> We create the client and verify domain ownership automatically.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" /> You&apos;re redirected to the technical SEO audit for the new site.
            </li>
          </ul>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" variant="primary" className="w-full" disabled={busy || !name.trim() || !url.trim() || !orgId}>
          {step === "idle" && "Add client"}
          {step === "creating" && (<><Sparkles size={14} className="mr-2 animate-pulse" /> Creating client…</>)}
          {step === "registering" && (<><Sparkles size={14} className="mr-2 animate-pulse" /> Registering website…</>)}
          {step === "verifying" && (<><Sparkles size={14} className="mr-2 animate-pulse" /> Verifying domain…</>)}
        </Button>
      </form>
    </div>
  );
}
