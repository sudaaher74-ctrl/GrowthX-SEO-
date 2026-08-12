"use client";
import { PageHeader, Panel, Table, Th, Tr, Td, ActionButton } from "@/components/ui/console";
import { Link2, Search, BarChart3, MessageSquare, Zap } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrations & Connections"
        subtitle="Connect external platforms to feed data into the 15-Engine system."
        actions={
          <ActionButton variant="primary" icon={<Zap size={12} />}>
            Add Integration
          </ActionButton>
        }
      />

      <Panel title="Connected Platforms" subtitle="Manage your active data sources.">
        <Table minWidth={720}>
          <thead>
            <tr>
              <Th>Platform</Th>
              <Th>Category</Th>
              <Th>Status</Th>
              <Th>Last Sync</Th>
              <Th align="right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: "1", name: "Google Search Console", icon: Search, cat: "Search Data", stat: "Connected", sync: "2 hours ago" },
              { id: "2", name: "Google Analytics 4", icon: BarChart3, cat: "Web Analytics", stat: "Connected", sync: "2 hours ago" },
              { id: "3", name: "Google Business Profile", icon: Link2, cat: "Local SEO", stat: "Connected", sync: "5 hours ago" },
              { id: "4", name: "Slack Alerts", icon: MessageSquare, cat: "Notifications", stat: "Connected", sync: "Real-time" },
            ].map((row) => (
              <Tr key={row.id}>
                <Td className="font-medium text-[#09090b] flex items-center gap-2">
                  <row.icon size={16} className="text-[#71717a]" />
                  {row.name}
                </Td>
                <Td className="text-[#3f3f46]">{row.cat}</Td>
                <Td><span className="text-[#16a34a] font-medium text-[13px]">{row.stat}</span></Td>
                <Td className="text-[#71717a]">{row.sync}</Td>
                <Td align="right">
                  <ActionButton variant="secondary">Configure</ActionButton>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}
