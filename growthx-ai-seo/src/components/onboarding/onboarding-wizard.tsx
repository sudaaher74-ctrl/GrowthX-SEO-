"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Database,
  ExternalLink,
  GitBranch,
  Globe,
  HelpCircle,
  Layers,
  Loader2,
  MapPin,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";
import { useQueryClient } from "@tanstack/react-query";

export type StepStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED"
  | "NEEDS_CONNECTION";

export interface BusinessFormData {
  name: string;
  url: string;
  country: string;
  city: string;
  industry: string;
  businessType: string;
  primaryOffering: string;
  address?: string;
  phone?: string;
}

const PROJECT_TYPES = [
  { id: "local", label: "Local Business", desc: "Physical locations, storefronts, regional service areas" },
  { id: "b2b", label: "B2B / Lead Generation", desc: "Corporate services, custom quotes, enterprise solutions" },
  { id: "ecommerce", label: "E-commerce", desc: "Online retail store with products, cart, and transactions" },
  { id: "saas", label: "SaaS & Software", desc: "Digital applications, recurring subscriptions, software platforms" },
  { id: "publisher", label: "Publisher / Content", desc: "Blogs, news media, high-volume informative publishing" },
  { id: "agency", label: "Agency / Client Project", desc: "Managing multi-client digital marketing and growth audits" },
];

export function OnboardingWizard({
  onComplete,
  className,
}: {
  onComplete?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { orgId, setOrgId, setProjectId, organizations, projects } = useWorkspace();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Step 1: Add Business Data
  const [businessData, setBusinessData] = useState<BusinessFormData>({
    name: "",
    url: "",
    country: "United States",
    city: "",
    industry: "Technology",
    businessType: "B2B",
    primaryOffering: "",
    address: "",
    phone: "",
  });

  // Step 2: Project Type
  const [projectType, setProjectType] = useState<string>("b2b");

  // Created entities in step 3/4
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [createdWebsiteId, setCreatedWebsiteId] = useState<string | null>(null);

  // Step 5: Checklist item statuses
  const [checklist, setChecklist] = useState<Record<string, StepStatus>>({
    website_added: "NOT_STARTED",
    crawl_completed: "NOT_STARTED",
    gsc_connected: "NEEDS_CONNECTION",
    ga_connected: "NEEDS_CONNECTION",
    gbp_connected: "NEEDS_CONNECTION",
    location_selected: "NOT_STARTED",
    competitors_added: "NOT_STARTED",
    report_ready: "NOT_STARTED",
  });

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessData.name.trim()) {
      setErrorMessage("Please enter the business name.");
      return;
    }
    if (!businessData.url.trim()) {
      setErrorMessage("Please enter the website URL.");
      return;
    }

    let domain = businessData.url.trim().toLowerCase();
    try {
      domain = domain.startsWith("http://") || domain.startsWith("https://") ? new URL(domain).hostname : domain;
    } catch {
      // keep raw
    }
    domain = domain.replace(/^www\./, "");
    if (!domain.includes(".")) {
      setErrorMessage("Please enter a valid domain (e.g. yourcompany.com).");
      return;
    }

    setErrorMessage("");
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    setCurrentStep(3);
  };

  const handleCreateAndInitialize = async () => {
    setIsSubmitting(true);
    setErrorMessage("");

    let domain = businessData.url.trim().toLowerCase();
    try {
      domain = domain.startsWith("http://") || domain.startsWith("https://") ? new URL(domain).hostname : domain;
    } catch {
      // keep raw
    }
    domain = domain.replace(/^www\./, "");

    try {
      // 1. Ensure active organization
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
          const cleanOrgName = businessData.name.trim() ? `${businessData.name.trim()} Workspace` : "Primary Workspace";
          const baseSlug = cleanOrgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "org";
          validOrg = await api.createOrganization(cleanOrgName, `${baseSlug}-${Date.now().toString(36)}`);
          await qc.invalidateQueries({ queryKey: ["organizations"] });
        }
      }

      currentOrgId = validOrg.id;
      setOrgId(currentOrgId);

      // 2. Create project
      const project = await api.createProject(businessData.name.trim(), currentOrgId);
      setProjectId(project.id);
      setCreatedProjectId(project.id);

      // Update checklist
      setChecklist((prev) => ({
        ...prev,
        website_added: "COMPLETED",
      }));

      // 3. Register website
      const website = await api.registerWebsite(businessData.url.trim(), domain, project.id);
      setCreatedWebsiteId(website.id);

      // 4. Verify domain
      await api.verifyDomain(website.id);

      // 5. Store business profile if endpoint exists
      try {
        await api.setBusinessProfile(project.id, {
          businessName: businessData.name.trim(),
          industry: businessData.industry || "General",
        });
      } catch (profileErr) {
        console.warn("Could not save extended profile metadata:", profileErr);
      }

      setCurrentStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initialize business project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunInitialAudit = async () => {
    if (!createdWebsiteId || !createdProjectId) return;
    setIsSubmitting(true);
    setErrorMessage("");

    setChecklist((prev) => ({
      ...prev,
      crawl_completed: "IN_PROGRESS",
    }));

    let domain = businessData.url.trim().toLowerCase();
    try {
      domain = domain.startsWith("http://") || domain.startsWith("https://") ? new URL(domain).hostname : domain;
    } catch {
      // keep raw
    }
    domain = domain.replace(/^www\./, "");

    try {
      // Trigger live website crawl
      await api.startCrawl({
        websiteId: createdWebsiteId,
        domain,
        maxDepth: 10,
        maxConcurrency: 3,
        useSitemap: true,
      });

      setChecklist((prev) => ({
        ...prev,
        crawl_completed: "COMPLETED",
        report_ready: "COMPLETED",
      }));

      // Invalidate portfolio and workspace
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["portfolio", orgId] }),
        qc.invalidateQueries({ queryKey: ["projects", orgId] }),
        qc.invalidateQueries({ queryKey: ["latest-crawl", createdWebsiteId] }),
      ]);

      setCurrentStep(5);
    } catch (err: any) {
      setChecklist((prev) => ({
        ...prev,
        crawl_completed: "FAILED",
      }));
      setErrorMessage(err.message || "Failed to initiate crawl.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("mx-auto max-w-2xl rounded-2xl border bg-white p-6 sm:p-8 shadow-sm", className)} style={{ borderColor: "var(--border-color)" }}>
      {/* Workflow Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-brand-400 uppercase mb-2">
          <span>Workflow Step {currentStep} of 5</span>
          <span className="font-mono text-brand-950">
            {currentStep === 1 && "Add Business"}
            {currentStep === 2 && "Project Type"}
            {currentStep === 3 && "Connect Data"}
            {currentStep === 4 && "Initial Analysis"}
            {currentStep === 5 && "Setup Checklist"}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full bg-brand-100 rounded-full overflow-hidden">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={cn(
                "h-full transition-all duration-300",
                s <= currentStep ? "bg-brand-950" : "bg-transparent"
              )}
            />
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-lg border border-error-200 bg-error-50/50 p-3 text-[12px] text-error-700">
          {errorMessage}
        </div>
      )}

      {/* Step 1: Add Business */}
      {currentStep === 1 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6">
            <h2 className="text-[20px] font-bold text-brand-950">Add Your Business</h2>
            <p className="text-[12.5px] text-brand-500 mt-1">
              Enter your core business details to establish accurate entity and domain tracking.
            </p>
          </div>

          <form onSubmit={handleStep1Next} className="space-y-4">
            <div>
              <label className="block text-[11.5px] font-semibold text-brand-700 uppercase tracking-wider mb-1">
                Business Name <span className="text-error-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. GrowthX Media"
                value={businessData.name}
                onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })}
                className="w-full h-10 rounded-lg border px-3 text-[13px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                style={{ borderColor: "var(--border-color)" }}
              />
            </div>

            <div>
              <label className="block text-[11.5px] font-semibold text-brand-700 uppercase tracking-wider mb-1">
                Website URL <span className="text-error-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. https://growthx.ai"
                value={businessData.url}
                onChange={(e) => setBusinessData({ ...businessData, url: e.target.value })}
                className="w-full h-10 rounded-lg border px-3 text-[13px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                style={{ borderColor: "var(--border-color)" }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11.5px] font-semibold text-brand-700 uppercase tracking-wider mb-1">
                  Country
                </label>
                <input
                  type="text"
                  placeholder="e.g. United States"
                  value={businessData.country}
                  onChange={(e) => setBusinessData({ ...businessData, country: e.target.value })}
                  className="w-full h-10 rounded-lg border px-3 text-[13px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  style={{ borderColor: "var(--border-color)" }}
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-brand-700 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. San Francisco"
                  value={businessData.city}
                  onChange={(e) => setBusinessData({ ...businessData, city: e.target.value })}
                  className="w-full h-10 rounded-lg border px-3 text-[13px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  style={{ borderColor: "var(--border-color)" }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11.5px] font-semibold text-brand-700 uppercase tracking-wider mb-1">
                  Industry / Niche
                </label>
                <input
                  type="text"
                  placeholder="e.g. Legal Services, SaaS, HVAC"
                  value={businessData.industry}
                  onChange={(e) => setBusinessData({ ...businessData, industry: e.target.value })}
                  className="w-full h-10 rounded-lg border px-3 text-[13px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  style={{ borderColor: "var(--border-color)" }}
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-brand-700 uppercase tracking-wider mb-1">
                  Primary Service / Product
                </label>
                <input
                  type="text"
                  placeholder="e.g. SEO Audit & Optimization"
                  value={businessData.primaryOffering}
                  onChange={(e) => setBusinessData({ ...businessData, primaryOffering: e.target.value })}
                  className="w-full h-10 rounded-lg border px-3 text-[13px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  style={{ borderColor: "var(--border-color)" }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-[11.5px] font-semibold text-brand-700 uppercase tracking-wider mb-1">
                  Address <span className="text-[10px] text-brand-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 500 Howard St"
                  value={businessData.address}
                  onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })}
                  className="w-full h-10 rounded-lg border px-3 text-[13px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  style={{ borderColor: "var(--border-color)" }}
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-brand-700 uppercase tracking-wider mb-1">
                  Phone <span className="text-[10px] text-brand-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +1 (555) 019-2834"
                  value={businessData.phone}
                  onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
                  className="w-full h-10 rounded-lg border px-3 text-[13px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  style={{ borderColor: "var(--border-color)" }}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg bg-brand-950 px-5 py-2.5 text-[12.5px] font-semibold text-white hover:opacity-90 transition"
              >
                Continue to Project Type
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Step 2: Select Project Type */}
      {currentStep === 2 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6">
            <h2 className="text-[20px] font-bold text-brand-950">Select Project Type</h2>
            <p className="text-[12.5px] text-brand-500 mt-1">
              Tailors crawler rules, schema validation, and competitor intelligence to your business model.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {PROJECT_TYPES.map((type) => {
              const selected = projectType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setProjectType(type.id)}
                  className={cn(
                    "flex flex-col items-start p-4 rounded-xl border text-left transition-all",
                    selected
                      ? "border-brand-950 bg-brand-50/50 ring-1 ring-brand-950"
                      : "border-gray-200 bg-white hover:border-brand-300"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[13.5px] font-semibold text-brand-950">{type.label}</span>
                    {selected && <CheckCircle2 size={16} className="text-brand-950" />}
                  </div>
                  <p className="text-[11.5px] text-brand-500 mt-1">{type.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 hover:text-brand-950 transition"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              type="button"
              onClick={handleStep2Next}
              className="flex items-center gap-2 rounded-lg bg-brand-950 px-5 py-2.5 text-[12.5px] font-semibold text-white hover:opacity-90 transition"
            >
              Continue to Connect Data
              <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Connect Data Sources */}
      {currentStep === 3 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6">
            <h2 className="text-[20px] font-bold text-brand-950">Connect Data Sources</h2>
            <p className="text-[12.5px] text-brand-500 mt-1">
              Link authoritative sources. You can also proceed now and connect them later in Integrations.
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between p-4 rounded-xl border bg-white" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Search size={18} />
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-brand-950">Google Search Console</h4>
                  <p className="text-[11px] text-brand-400">Authentic clicks, impressions, and index status</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-brand-500 px-2.5 py-1 rounded bg-brand-100">
                Connect in Step 5 / Integrations
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border bg-white" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-brand-950">Google Analytics 4</h4>
                  <p className="text-[11px] text-brand-400">User sessions, engaged landing pages, and conversions</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-brand-500 px-2.5 py-1 rounded bg-brand-100">
                Connect in Step 5 / Integrations
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border bg-white" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <MapPin size={18} />
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-brand-950">Google Business Profile</h4>
                  <p className="text-[11px] text-brand-400">Reviews, ratings, local rankings, and calls</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-brand-500 px-2.5 py-1 rounded bg-brand-100">
                Connect in Step 5 / Integrations
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border bg-white" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                  <GitBranch size={18} />
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-brand-950">GitHub Repository</h4>
                  <p className="text-[11px] text-brand-400">Automated pull requests for code & schema fixes</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-brand-500 px-2.5 py-1 rounded bg-brand-100">
                Optional
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 hover:text-brand-950 transition"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateAndInitialize}
              className="flex items-center gap-2 rounded-lg bg-brand-950 px-5 py-2.5 text-[12.5px] font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating Project...
                </>
              ) : (
                <>
                  Register Business & Initialize
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Run Initial Analysis */}
      {currentStep === 4 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6">
            <h2 className="text-[20px] font-bold text-brand-950">Run Initial Analysis</h2>
            <p className="text-[12.5px] text-brand-500 mt-1">
              Launch the GrowthX crawler to discover technical health, thin content, and ranking opportunities.
            </p>
          </div>

          <div className="rounded-xl border p-5 bg-brand-50/40 mb-6" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border shadow-2xs text-brand-950">
                <Globe size={20} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-semibold text-brand-950">Full Website Audit Sweep</h4>
                <p className="text-[12px] text-brand-500 mt-0.5 leading-relaxed">
                  Crawls pages, builds the directed internal link graph, checks schema validity (Product, Article, LocalBusiness), evaluates headings, and computes your unified 0–100 health score.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono text-brand-600">
                  <span className="rounded bg-white border px-2 py-0.5">Target: {businessData.url}</span>
                  <span className="rounded bg-white border px-2 py-0.5">Type: {projectType.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className="text-[12px] font-semibold text-brand-500 hover:text-brand-800 transition"
            >
              Skip initial crawl for now
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleRunInitialAudit}
              className="flex items-center gap-2 rounded-lg bg-brand-950 px-5 py-2.5 text-[12.5px] font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Starting Crawl...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Start Initial Audit
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 5: Setup Checklist */}
      {currentStep === 5 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6">
            <h2 className="text-[20px] font-bold text-brand-950">Setup Checklist</h2>
            <p className="text-[12.5px] text-brand-500 mt-1">
              Track the setup status of your new business. Statuses update in real time as data arrives.
            </p>
          </div>

          <div className="space-y-2.5 mb-6">
            {[
              { id: "website_added", label: "Website Added & Verified", href: "/website" },
              { id: "crawl_completed", label: "Website Crawl & Health Audit", href: "/website" },
              { id: "gsc_connected", label: "Google Search Console Connected", href: "/integrations" },
              { id: "ga_connected", label: "Google Analytics 4 Connected", href: "/integrations" },
              { id: "gbp_connected", label: "Google Business Profile Connected", href: "/local" },
              { id: "location_selected", label: "Business Location & Niche Set", href: "/settings" },
              { id: "competitors_added", label: "Tracked Competitors Added", href: "/competitor-intelligence" },
              { id: "report_ready", label: "Executive SEO Baseline Report", href: "/reports" },
            ].map((item) => {
              const status = checklist[item.id] || "NOT_STARTED";
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <span className="text-[12.5px] font-medium text-brand-950">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <StatusPill status={status} />
                    {item.href && (
                      <button
                        type="button"
                        onClick={() => router.push(item.href)}
                        className="p-1 text-brand-400 hover:text-brand-950 transition"
                        title={`Go to ${item.label}`}
                      >
                        <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
            <button
              type="button"
              onClick={() => {
                if (onComplete) onComplete();
                else router.push("/dashboard");
              }}
              className="flex items-center gap-2 rounded-lg bg-brand-950 px-5 py-2.5 text-[12.5px] font-semibold text-white hover:opacity-90 transition"
            >
              Open Dashboard
              <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: StepStatus }) {
  switch (status) {
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Completed
        </span>
      );
    case "IN_PROGRESS":
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Loader2 size={10} className="animate-spin" />
          In Progress
        </span>
      );
    case "NEEDS_CONNECTION":
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Needs Connection
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Failed
        </span>
      );
    case "SKIPPED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-brand-100 text-brand-500 border border-brand-200">
          Skipped
        </span>
      );
    case "NOT_STARTED":
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-brand-50 text-brand-500 border border-brand-200">
          Not Started
        </span>
      );
  }
}
