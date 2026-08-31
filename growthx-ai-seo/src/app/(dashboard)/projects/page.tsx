"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Globe, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";

/**
 * The "Add client" flow linked from /clients. Creates the Project first, then
 * registers the website against it — a website with no projectId never shows
 * up in the portfolio, so the two calls have to happen in this order.
 */
export default function AddClientPage() {
  const router = useRouter();
  const { orgId, setOrgId, setProjectId, organizations, projects } = useWorkspace();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<"idle" | "creating" | "registering" | "verifying">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    
    // Enforce 2 project limit
    if (projects.length >= 2) {
      setError("You can only add a maximum of 2 projects per account.");
      return;
    }
    
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

      // 1. Ensure an active organization exists and user is a confirmed member
      let currentOrgId = orgId;
      let validOrg = organizations.find((o) => o.id === currentOrgId);

      if (!validOrg) {
        let userOrgs: { id: string; name: string; slug: string }[] = [];
        try {
          userOrgs = await api.listOrganizations();
        } catch {
          userOrgs = [];
        }

        validOrg = userOrgs[0];
        if (!validOrg) {
          const cleanOrgName = name.trim() ? `${name.trim()} Workspace` : "My Agency Workspace";
          const baseSlug = cleanOrgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "org";
          const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
          validOrg = await api.createOrganization(cleanOrgName, uniqueSlug);
          await qc.invalidateQueries({ queryKey: ["organizations"] });
        }
      }

      currentOrgId = validOrg.id;
      setOrgId(currentOrgId);

      // 2. Create project for client
      const project = await api.createProject(name.trim(), currentOrgId);
      setProjectId(project.id);

      // 3. Register website
      setStep("registering");
      const website = await api.registerWebsite(url.trim(), domain, project.id);

      // 4. Verify domain & start audit
      setStep("verifying");
      await api.verifyDomain(website.id);

      try {
        await api.startCrawl({ websiteId: website.id, domain, maxDepth: 20, maxConcurrency: 5, useSitemap: true });
      } catch (crawlErr) {
        console.warn("Initial crawl start notice:", crawlErr);
      }

      // Invalidate queries so portfolio and dashboard reflect the new site
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["organizations"] }),
        qc.invalidateQueries({ queryKey: ["portfolio", currentOrgId] }),
        qc.invalidateQueries({ queryKey: ["projects", currentOrgId] }),
        qc.invalidateQueries({ queryKey: ["latest-crawl", domain] }),
      ]);

      router.push(`/website?domain=${encodeURIComponent(domain)}`);
    } catch (err) {
      console.error("Add client error:", err);
      setError(err instanceof Error ? err.message : "Failed to add client");
      setStep("idle");
    }
  }

  const busy = step !== "idle";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={14} /> Back to projects
      </Link>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-h1 text-[var(--text-primary)]">Add a project</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Creates the project record and registers the website so it starts showing up in your portfolio.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">Project name</label>
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
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" /> We create the project and verify domain ownership automatically.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" /> You&apos;re redirected to the technical SEO audit for the new site.
            </li>
          </ul>
        </div>

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}

        <Button type="submit" variant="primary" className="w-full" disabled={busy || !name.trim() || !url.trim() || projects.length >= 2}>
          {step === "idle" && "Add project"}
          {step === "creating" && (<><Sparkles size={14} className="mr-2 animate-pulse" /> Creating project…</>)}
          {step === "registering" && (<><Sparkles size={14} className="mr-2 animate-pulse" /> Registering website…</>)}
          {step === "verifying" && (<><Sparkles size={14} className="mr-2 animate-pulse" /> Verifying domain…</>)}
        </Button>
      </form>
    </div>
  );
}
