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
            <tr>
              <Td colSpan={5} className="text-center py-8 text-[var(--text-muted)]">
                No integrations connected.
              </Td>
            </tr>
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}
