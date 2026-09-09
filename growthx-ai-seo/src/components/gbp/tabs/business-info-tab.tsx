"use client";

import React, { useState } from "react";
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  Clock,
  FileText,
  Sparkles,
  Save,
  Check,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import { GoogleGLogo } from "../gbp-icons";
import type { LocalSeoData } from "@/lib/api-client";
import { useConnectLocalBusiness } from "@/hooks/use-growthx";

interface BusinessInfoTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
}

export function BusinessInfoTab({ localSeo, projectId }: BusinessInfoTabProps) {
  const [businessName, setBusinessName] = useState(localSeo?.businessName || "");
  const [address, setAddress] = useState(localSeo?.address || "");
  const [phone, setPhone] = useState("+1 (555) 019-2831");
  const [website, setWebsite] = useState("https://example.com");
  const [description, setDescription] = useState(
    "Leading local specialist offering premier services, trusted customer care, and rapid response times in the greater metro area."
  );
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const connectMutation = useConnectLocalBusiness(projectId);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !address) return;
    connectMutation.mutate(
      {
        businessName,
        address,
        rating: localSeo?.rating || 0,
        reviewCount: localSeo?.reviewCount || 0,
      },
      {
        onSuccess: () => {
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
        },
      }
    );
  };

  const handleAiDescription = () => {
    setIsGeneratingAi(true);
    setTimeout(() => {
      setDescription(
        `${businessName} is a top-rated local establishment located at ${address}. Dedicated to providing five-star service, verified quality, and tailored solutions. Open 7 days a week with convenient access and dedicated customer support.`
      );
      setIsGeneratingAi(false);
    }, 600);
  };

  const daysOfWeek = [
    { day: "Monday", open: "09:00 AM", close: "08:00 PM", active: true },
    { day: "Tuesday", open: "09:00 AM", close: "08:00 PM", active: true },
    { day: "Wednesday", open: "09:00 AM", close: "08:00 PM", active: true },
    { day: "Thursday", open: "09:00 AM", close: "08:00 PM", active: true },
    { day: "Friday", open: "09:00 AM", close: "09:00 PM", active: true },
    { day: "Saturday", open: "10:00 AM", close: "06:00 PM", active: true },
    { day: "Sunday", open: "Closed", close: "", active: false },
  ];

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Top Banner Actions */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border shadow-xs" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h2 className="text-sm font-bold text-brand-950">Core Business Information</h2>
          <p className="text-xs text-brand-500">
            Ensure your Name, Address, and Phone (NAP) exactly match official records to boost Google Maps rankings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
              <Check size={13} /> Saved to Profile
            </span>
          )}
          <button
            type="submit"
            disabled={connectMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition shadow-xs disabled:opacity-50"
          >
            <Save size={13} />
            <span>{connectMutation.isPending ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Core Fields (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Basic Details Card */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-4" style={{ borderColor: "var(--border-color)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-1.5">
              <Building2 size={13} className="text-blue-600" />
              <span>Listing Identity</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-brand-800 mb-1">
                Business Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Acme Dental Clinic"
                className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-800 mb-1">
                Physical Storefront Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, Suite, City, State, ZIP"
                className="w-full h-9 px-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-brand-800 mb-1">
                  Primary Phone
                </label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-800 mb-1">
                  Website URL
                </label>
                <div className="relative">
                  <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Business Description Card */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-1.5">
                <FileText size={13} className="text-blue-600" />
                <span>Business Description</span>
              </h3>

              <button
                type="button"
                onClick={handleAiDescription}
                disabled={isGeneratingAi}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg transition"
              >
                <Sparkles size={12} className={isGeneratingAi ? "animate-spin" : ""} />
                <span>{isGeneratingAi ? "Optimizing…" : "Generate with AI"}</span>
              </button>
            </div>

            <textarea
              rows={4}
              maxLength={750}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950 leading-relaxed"
            />

            <div className="flex items-center justify-between text-[11px] text-brand-400">
              <span>Google allows up to 750 characters. Mention high-priority local keywords naturally.</span>
              <span className="font-mono font-semibold text-brand-700">{description.length}/750</span>
            </div>
          </div>
        </div>

        {/* Right Column: Business Hours & Service Area (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Operating Hours Card */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3.5" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-1.5">
                <Clock size={13} className="text-emerald-600" />
                <span>Regular Operating Hours</span>
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Verified
              </span>
            </div>

            <div className="space-y-2 divide-y divide-brand-100">
              {daysOfWeek.map((schedule) => (
                <div key={schedule.day} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                  <span className="font-semibold text-brand-800 w-24">{schedule.day}</span>
                  {schedule.active ? (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-brand-600">
                      <span>{schedule.open}</span>
                      <span>–</span>
                      <span>{schedule.close}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-rose-600">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Service Area Card */}
          <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3" style={{ borderColor: "var(--border-color)" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-1.5">
              <MapPin size={13} className="text-blue-600" />
              <span>Service Area & Neighborhoods</span>
            </h3>

            <p className="text-xs text-brand-500 leading-normal">
              Specify the regions or delivery radius where your staff visits or serves customers.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {["Baner", "Aundh", "Balewadi", "Pashan", "Hinjewadi", "Shivajinagar"].map((area) => (
                <span
                  key={area}
                  className="inline-flex items-center gap-1 rounded-md bg-brand-100 text-brand-800 px-2 py-0.5 text-xs font-medium"
                >
                  <MapPin size={10} className="text-brand-500" />
                  {area}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
