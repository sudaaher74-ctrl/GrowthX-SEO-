"use client";

import { motion } from "framer-motion";
import { Search, ExternalLink, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const mockIndexData = [
  { date: 'Mon', indexed: 1200, excluded: 150 },
  { date: 'Tue', indexed: 1250, excluded: 145 },
  { date: 'Wed', indexed: 1300, excluded: 140 },
  { date: 'Thu', indexed: 1280, excluded: 160 },
  { date: 'Fri', indexed: 1350, excluded: 130 },
  { date: 'Sat', indexed: 1400, excluded: 125 },
  { date: 'Sun', indexed: 1450, excluded: 120 },
];

export function GoogleIndexStatus() {
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Search className="text-blue-500" size={20} />
            Google Index Status
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Live sync from Search Console API</p>
        </div>
        <a href="#" className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-brand-600)] dark:text-[var(--color-brand-400)] hover:underline">
          View in GSC <ExternalLink size={12} />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--surface-2)] rounded-xl p-4 border border-[var(--border-color)]">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm mb-2">
            <CheckCircle2 size={16} /> Valid Pages
          </div>
          <div className="text-3xl font-black text-[var(--text-primary)]">1,450</div>
          <div className="text-xs font-medium text-emerald-500 mt-1 flex items-center gap-1">
            <ArrowUpRight size={14} /> +12% this week
          </div>
        </div>

        <div className="bg-[var(--surface-2)] rounded-xl p-4 border border-[var(--border-color)]">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-sm mb-2">
            <AlertTriangle size={16} /> Excluded
          </div>
          <div className="text-3xl font-black text-[var(--text-primary)]">120</div>
          <div className="text-xs font-medium text-emerald-500 mt-1 flex items-center gap-1">
            <ArrowDownRight size={14} /> -5% this week
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[150px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockIndexData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIndexed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ color: 'var(--text-primary)' }}
            />
            <Area type="monotone" dataKey="indexed" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIndexed)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
          <ShieldCheck size={14} className="text-emerald-500" /> API Connected
        </div>
        <span className="text-xs text-[var(--text-muted)]">Last synced: 2m ago</span>
      </div>
    </div>
  );
}
