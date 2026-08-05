"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { X, Globe, Sparkles, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

interface AddWebsiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (domain: string) => void;
  hasActiveProject: boolean;
}

export function AddWebsiteModal({ isOpen, onClose, onSuccess, hasActiveProject }: AddWebsiteModalProps) {
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      // Basic URL extraction to get domain
      let domain = url.trim().toLowerCase();
      if (domain.startsWith("http://") || domain.startsWith("https://")) {
        domain = new URL(domain).hostname;
      }
      // Remove www.
      if (domain.startsWith("www.")) {
        domain = domain.substring(4);
      }

      if (!domain || !domain.includes(".")) {
        setError("Please enter a valid domain name (e.g., example.com)");
        return;
      }

      setIsSubmitting(true);
      setError("");

      // 1. Register
      const website = await api.registerWebsite(url.trim(), domain);
      
      // 2. Verify
      await api.verifyDomain(website.id);

      // Success
      setIsSubmitting(false);
      onSuccess(domain);
      onClose();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add website");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[var(--bg-base)] shadow-2xl rounded-2xl border border-[var(--border-color)] overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Add New Website</h2>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={18} />
            </button>
          </div>

          {hasActiveProject ? (
            /* Limit Reached View */
            <div className="p-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="text-amber-600 dark:text-amber-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Plan Limit Reached</h3>
              <p className="text-[var(--text-secondary)] text-sm mb-6">
                Your current plan allows 1 website per account. Upgrade to the Pro plan to manage multiple websites, increase crawl limits, and unlock AI auto-fixes.
              </p>
              <Button className="w-full bg-gradient-brand text-white shadow-glow-brand hover:opacity-90 transition-opacity h-11 text-base font-semibold group">
                Upgrade to Pro <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <button onClick={onClose} className="mt-4 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                Maybe later
              </button>
            </div>
          ) : (
            /* Add Website Form */
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Website URL
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] focus:border-transparent transition-all"
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                
                <div className="mt-4 bg-[var(--surface-2)] p-4 rounded-xl border border-[var(--border-color)]">
                  <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-2">What happens next?</h4>
                  <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-[var(--color-success-500)] shrink-0 mt-0.5" />
                      We will automatically verify domain ownership.
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-[var(--color-success-500)] shrink-0 mt-0.5" />
                      You will be redirected to the Technical SEO Audit dashboard.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-[var(--color-brand-500)] hover:bg-[var(--color-brand-600)] text-white"
                  disabled={isSubmitting || !url}
                >
                  {isSubmitting ? (
                    <><Sparkles size={16} className="mr-2 animate-pulse" /> Adding...</>
                  ) : "Add Website"}
                </Button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
