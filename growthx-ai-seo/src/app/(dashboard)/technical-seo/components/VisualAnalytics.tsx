"use client";

import { motion } from "framer-motion";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { issuesByCategory, healthTrendData, issueSeverityData, pageSpeedDistribution } from "@/lib/mock-seo-data";

export function VisualAnalytics() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      {/* Issues by Category (Donut) */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-[var(--card-bg)] rounded-[var(--radius-xl)] border border-[var(--border-color)] p-6 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Issues by Category</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={issuesByCategory}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {issuesByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-overlay)' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Health Trend (Line) */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="bg-[var(--card-bg)] rounded-[var(--radius-xl)] border border-[var(--border-color)] p-6 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">30-Day Health Trend</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={healthTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-overlay)' }}
              />
              <Line type="monotone" dataKey="score" stroke="var(--color-success-500)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Issue Severity (Stacked Bar) */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
        className="bg-[var(--card-bg)] rounded-[var(--radius-xl)] border border-[var(--border-color)] p-6 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Issue Severity History</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={issueSeverityData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-overlay)' }}
                cursor={{ fill: 'var(--bg-muted)' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
              <Bar dataKey="critical" stackId="a" fill="var(--color-error-500)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="high" stackId="a" fill="var(--color-warning-500)" />
              <Bar dataKey="medium" stackId="a" fill="#eab308" />
              <Bar dataKey="low" stackId="a" fill="var(--color-brand-300)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Page Speed Distribution (Histogram via BarChart) */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="bg-[var(--card-bg)] rounded-[var(--radius-xl)] border border-[var(--border-color)] p-6 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Page Speed Distribution (LCP)</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pageSpeedDistribution} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="range" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-overlay)' }}
                cursor={{ fill: 'var(--bg-muted)' }}
              />
              <Bar dataKey="pages" fill="var(--color-brand-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
