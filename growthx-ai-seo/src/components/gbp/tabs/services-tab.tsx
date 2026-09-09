"use client";

import React, { useState } from "react";
import {
  Briefcase,
  Plus,
  Trash2,
  Sparkles,
  Check,
  Tag,
  DollarSign,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ServicesTabProps {
  localSeo: LocalSeoData | null | undefined;
}

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price?: string;
}

export function ServicesTab({ localSeo }: ServicesTabProps) {
  const [services, setServices] = useState<ServiceItem[]>([
    {
      id: "1",
      category: "General Dentistry",
      name: "Comprehensive Dental Exam & Cleaning",
      description: "Thorough oral health assessment, tartar removal, and preventive fluoride polish.",
      price: "$120",
    },
    {
      id: "2",
      category: "Cosmetic Services",
      name: "Professional Teeth Whitening",
      description: "In-office LED laser teeth whitening brightening up to 8 shades in a single session.",
      price: "$299",
    },
    {
      id: "3",
      category: "Cosmetic Services",
      name: "Porcelain Veneers Consultation",
      description: "Custom digital smile design and premium ultra-thin porcelain veneer placement.",
      price: "Free consultation",
    },
    {
      id: "4",
      category: "Emergency Dental",
      name: "Same-Day Emergency Relief",
      description: "Immediate relief for toothaches, chipped teeth, and urgent restorative procedures.",
      price: "From $90",
    },
  ]);

  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState("General Dentistry");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const aiSuggestions = [
    {
      name: "Invisalign Clear Aligners",
      category: "Orthodontics",
      description: "Invisible aligners for teeth straightening without traditional metal brackets.",
    },
    {
      name: "Dental Implant Restoration",
      category: "Restorative",
      description: "Permanent titanium implant root with custom-matched porcelain crown.",
    },
    {
      name: "Pediatric Gentle Cleaning",
      category: "Pediatric",
      description: "Child-friendly dental hygiene and fluoride cavity prevention treatments.",
    },
  ];

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newItem: ServiceItem = {
      id: `svc-${newName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${services.length + 1}`,
      name: newName.trim(),
      category: newCat.trim(),
      description: newDesc.trim() || "Professional service delivered with care.",
      price: newPrice.trim() || undefined,
    };

    setServices([...services, newItem]);
    setNewName("");
    setNewDesc("");
    setNewPrice("");
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  const handleAcceptAiSuggestion = (sug: typeof aiSuggestions[0]) => {
    const newItem: ServiceItem = {
      id: `sug-${sug.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${services.length + 1}`,
      name: sug.name,
      category: sug.category,
      description: sug.description,
      price: "Contact for pricing",
    };
    setServices([...services, newItem]);
  };

  // Group by category
  const categories = Array.from(new Set(services.map((s) => s.category)));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border shadow-xs" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h2 className="text-sm font-bold text-brand-950">Services & Menus Catalog</h2>
          <p className="text-xs text-brand-500">
            Showcase your core services directly on Google Search & Maps to convert high-intent searchers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition shadow-xs"
          >
            <Plus size={13} />
            <span>Add New Service</span>
          </button>
        </div>
      </div>

      {/* Add New Service Form */}
      {isAdding && (
        <form onSubmit={handleAddService} className="p-5 rounded-2xl border border-blue-200 bg-blue-50/40 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
            Add Service to Google Business Profile
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-800 mb-1">Service Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Teeth Whitening"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-800 mb-1">Category</label>
              <input
                type="text"
                placeholder="e.g. Cosmetic Dentistry"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-800 mb-1">Price (Optional)</label>
              <input
                type="text"
                placeholder="e.g. $150 or Free"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-800 mb-1">Service Description</label>
            <textarea
              rows={2}
              placeholder="Brief description of what is included in this service (up to 300 characters)..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full p-2.5 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-lg border border-brand-200 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
            >
              Save Service
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Grouped Services (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {categories.map((cat) => (
            <div key={cat} className="rounded-2xl border bg-white p-5 shadow-xs space-y-3" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border-color)" }}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700 flex items-center gap-1.5">
                  <Tag size={12} className="text-blue-600" />
                  <span>{cat}</span>
                </h3>
                <span className="text-[10px] font-bold text-brand-500">
                  {services.filter((s) => s.category === cat).length} services
                </span>
              </div>

              <div className="divide-y divide-brand-100">
                {services
                  .filter((s) => s.category === cat)
                  .map((item) => (
                    <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-brand-950">{item.name}</p>
                          {item.price && (
                            <span className="rounded-md bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold px-1.5 py-0.2 border border-emerald-200">
                              {item.price}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-brand-500 mt-1 leading-relaxed">{item.description}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="text-brand-300 hover:text-rose-600 p-1 rounded transition"
                        title="Remove service"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: AI Service Suggestions (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3.5" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-500">
              <Sparkles size={13} className="text-purple-600" />
              <span>AI Service Suggestions</span>
            </div>

            <p className="text-xs text-brand-500 leading-normal">
              Based on your website crawl and local search demand, customers frequently look for these services:
            </p>

            <div className="space-y-3 pt-1">
              {aiSuggestions.map((sug) => (
                <div key={sug.name} className="p-3 rounded-xl border border-brand-100 bg-brand-50/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                      {sug.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAcceptAiSuggestion(sug)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                    >
                      <Plus size={11} />
                      Add to Profile
                    </button>
                  </div>
                  <p className="text-xs font-bold text-brand-950">{sug.name}</p>
                  <p className="text-[11px] text-brand-500 leading-snug">{sug.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
