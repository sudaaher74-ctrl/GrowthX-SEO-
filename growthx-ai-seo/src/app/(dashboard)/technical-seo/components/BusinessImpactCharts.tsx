"use client";

import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingDown, AlertCircle } from "lucide-react";

const data = [
  { name: 'Jan', trafficLoss: 0, revenueLoss: 0 },
  { name: 'Feb', trafficLoss: 0, revenueLoss: 0 },
  { name: 'Mar', trafficLoss: 0, revenueLoss: 0 },
  { name: 'Apr', trafficLoss: 0, revenueLoss: 0 },
  { name: 'May', trafficLoss: 0, revenueLoss: 0 },
  { name: 'Jun', trafficLoss: 0, revenueLoss: 0 },
];

export function BusinessImpactCharts({ issues }: { issues: any[] }) {
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            Business Impact
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">Connect Google Analytics to see simulated revenue and traffic loss.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-[var(--text-primary)]">Pending GA4</div>
          <div className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 justify-end">
             Awaiting Connection
          </div>
        </div>
      </div>

      <div className="flex-1 w-full h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickFormatter={(val) => `$${val}`} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
              itemStyle={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}
            />
            <Area type="monotone" dataKey="revenueLoss" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue Loss" />
            <Area type="monotone" dataKey="trafficLoss" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorTraffic)" name="Traffic Loss" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[var(--border-color)] pt-4">
        <div>
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase">Lost Leads</div>
          <div className="text-lg font-bold text-[var(--text-primary)] mt-1">N/A</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase">Missed Clicks</div>
          <div className="text-lg font-bold text-[var(--text-primary)] mt-1">N/A</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase">Indexation Loss</div>
          <div className="text-lg font-bold text-[var(--text-primary)] mt-1 flex items-center gap-2">
            N/A
          </div>
        </div>
      </div>
    </div>
  );
}
