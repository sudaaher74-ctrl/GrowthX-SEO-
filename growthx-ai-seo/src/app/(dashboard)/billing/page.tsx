"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, Zap, Star } from "lucide-react";

const plans = [
  {
    id: "starter", name: "Starter", price: 2000, currency: "₹", period: "month",
    description: "For solo founders and local businesses",
    features: ["1 website", "GSC + GA4 integration", "Technical SEO audit", "AI meta optimizer", "Local page generator (10 pages)", "Basic reports", "Email support"],
    current: false, popular: false, color: "border-[var(--border-color)]",
  },
  {
    id: "growth", name: "Growth", price: 5000, currency: "₹", period: "month",
    description: "For growing businesses and small agencies",
    features: ["5 websites", "Everything in Starter", "Rank tracking (200 keywords)", "Competitor analysis (3 competitors)", "AI content engine (20 pages/mo)", "Automations (5 workflows)", "PDF/Excel reports", "Priority support"],
    current: true, popular: true, color: "border-purple-500",
  },
  {
    id: "agency", name: "Agency", price: 15000, currency: "₹", period: "month",
    description: "For SEO agencies managing multiple clients",
    features: ["25 websites", "Everything in Growth", "Rank tracking (unlimited)", "Unlimited competitors", "AI content engine (unlimited)", "Unlimited automations", "White-label reports", "API access", "Dedicated support"],
    current: false, popular: false, color: "border-violet-500",
  },
];

const usageItems = [
  { label: "AI Content Pages Generated", used: 14, limit: 20, color: "bg-purple-500" },
  { label: "Keywords Tracked", used: 8, limit: 200, color: "bg-violet-500" },
  { label: "Automation Runs", used: 47, limit: 150, color: "bg-emerald-500" },
  { label: "API Calls (GSC/GA4)", used: 2840, limit: 10000, color: "bg-amber-500" },
];

export default function BillingPage() {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-h1 text-[var(--text-primary)]">Billing & Plans</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Manage your subscription, usage, and payment</p>
      </motion.div>

      {/* Current Plan + Usage */}
      <div className="grid xl:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Current Plan</h3>
              <div className="text-3xl font-bold gradient-text-brand mt-1">Growth</div>
              <div className="text-sm text-[var(--text-muted)]">₹5,000 / month · Renews Aug 27, 2026</div>
            </div>
            <Badge variant="success">Active</Badge>
          </div>
          <Button variant="outline" size="sm">Change Plan</Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Usage This Month</h3>
          <div className="space-y-3">
            {usageItems.map(u => (
              <div key={u.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--text-secondary)]">{u.label}</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{u.used} / {u.limit}</span>
                </div>
                <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(u.used / u.limit) * 100}%` }} transition={{ duration: 0.8, delay: 0.3 }}
                    className={cn("h-full rounded-full", u.color)}/>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Plans */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">All Plans</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan, i) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
              className={cn("card p-6 relative border-2", plan.color, plan.popular && "shadow-glow-brand")}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="gradient-bg-brand text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star size={10}/> Most Popular
                  </span>
                </div>
              )}
              <div className="mb-4">
                <h4 className="text-lg font-bold text-[var(--text-primary)]">{plan.name}</h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{plan.description}</p>
                <div className="text-3xl font-bold gradient-text-brand mt-3">
                  {plan.currency}{plan.price.toLocaleString()}<span className="text-base font-normal text-[var(--text-muted)]">/{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0"/>
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant={plan.current ? "secondary" : plan.popular ? "primary" : "outline"} className="w-full">
                {plan.current ? "Current Plan" : "Switch to " + plan.name}
              </Button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
