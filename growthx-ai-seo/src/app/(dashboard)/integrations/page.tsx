"use client";
import { Suspense, useState } from "react";
import { Loader2, Plus, GitBranch, Search, BarChart3, Database } from "lucide-react";
import {
  ActionButton,
  PageHeader,
  Panel,
  Table,
  Th,
  Tr,
  Td,
  Pill,
  Mono,
  relativeTime,
} from "@/components/ui/console";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { useConnectRepository, useRepository, useWorkspace, useIntegrations } from "@/hooks/use-growthx";

function IntegrationsClient() {
  const { projectId } = useWorkspace();
  const repo = useRepository(projectId);
  const connectRepo = useConnectRepository(projectId);
  const { data: integrationsData } = useIntegrations(projectId);

  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [githubForm, setGithubForm] = useState({
    owner: "sudaaher74-ctrl",
    name: "GrowthX-SEO-",
    defaultBranch: "main",
    accessToken: "",
    framework: "nextjs",
    contentDir: "src/app",
  });

  const handleConnectGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    await connectRepo.mutateAsync(githubForm);
    setConnectingGitHub(false);
  };

  const integrations = [
    {
      id: "github",
      name: "GitHub",
      category: "Code Repository",
      icon: GitBranch,
      status: repo.data ? "CONNECTED" : "NOT_CONNECTED",
      lastSync: repo.data?.updatedAt,
      metadata: repo.data ? `${repo.data.owner}/${repo.data.name}` : null,
      onConnect: () => setConnectingGitHub(true),
    },
    {
      id: "gsc",
      name: "Google Search Console",
      category: "SEO Data",
      icon: Search,
      status: integrationsData?.gscConnected ? "CONNECTED" : "NOT_CONNECTED",
      lastSync: integrationsData?.updatedAt,
      metadata: integrationsData?.gscPropertyId || null,
    },
    {
      id: "ga4",
      name: "Google Analytics 4",
      category: "Analytics",
      icon: BarChart3,
      status: integrationsData?.gaConnected ? "CONNECTED" : "NOT_CONNECTED",
      lastSync: integrationsData?.updatedAt,
      metadata: integrationsData?.gaPropertyId || null,
    },
    {
      id: "hubspot",
      name: "HubSpot / Salesforce",
      category: "CRM & Marketing",
      icon: Database,
      status: integrationsData?.hubspotConnected ? "CONNECTED" : "NOT_CONNECTED",
      lastSync: integrationsData?.updatedAt,
      metadata: integrationsData?.hubspotPortalId || null,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrations & Connections"
        subtitle="Connect external platforms to feed data into the 15-Engine system."
        actions={
          <ActionButton variant="primary" icon={<Plus size={12} />}>
            Add Integration
          </ActionButton>
        }
      />

      <QueryState
        isLoading={repo.isLoading}
        error={repo.error}
        isEmpty={false}
      >
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
              {integrations.map((int) => (
                <Tr key={int.id}>
                  <Td>
                    <div className="flex items-center space-x-3">
                      <int.icon size={16} className="text-brand-500" />
                      <span className="font-medium text-brand-950">{int.name}</span>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-brand-500">{int.category}</span>
                  </Td>
                  <Td>
                    {int.status === "CONNECTED" ? (
                      <Pill tone="good">Connected</Pill>
                    ) : int.status === "COMING_SOON" ? (
                      <Pill tone="default">Coming Soon</Pill>
                    ) : (
                      <Pill tone="warn">Not Connected</Pill>
                    )}
                    {int.metadata && <span className="block mt-1 text-[11px] text-brand-400"><Mono>{int.metadata}</Mono></span>}
                  </Td>
                  <Td>
                    <span className="text-brand-500">
                      {int.lastSync ? relativeTime(int.lastSync) : "—"}
                    </span>
                  </Td>
                  <Td align="right">
                    {int.status === "CONNECTED" ? (
                      <ActionButton disabled>Connected</ActionButton>
                    ) : int.status === "COMING_SOON" ? (
                      <ActionButton disabled>Coming Soon</ActionButton>
                    ) : (
                      <ActionButton onClick={int.onConnect} variant="primary">
                        Connect
                      </ActionButton>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        {connectingGitHub && (
          <Panel title="Connect GitHub Repository" subtitle="Give the Autonomous Engineer access to push fixes and content.">
            <form onSubmit={handleConnectGitHub} className="p-4 space-y-4 max-w-lg">
              <div className="space-y-1">
                <label className="text-sm font-medium text-brand-950">Owner</label>
                <input
                  type="text"
                  required
                  value={githubForm.owner}
                  onChange={(e) => setGithubForm({ ...githubForm, owner: e.target.value })}
                  className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  placeholder="e.g. sudaaher74-ctrl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-brand-950">Repository Name</label>
                <input
                  type="text"
                  required
                  value={githubForm.name}
                  onChange={(e) => setGithubForm({ ...githubForm, name: e.target.value })}
                  className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  placeholder="e.g. GrowthX-SEO-"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-brand-950">Default Branch</label>
                <input
                  type="text"
                  required
                  value={githubForm.defaultBranch}
                  onChange={(e) => setGithubForm({ ...githubForm, defaultBranch: e.target.value })}
                  className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-brand-950">Framework</label>
                <select
                  value={githubForm.framework}
                  onChange={(e) => setGithubForm({ ...githubForm, framework: e.target.value })}
                  className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                >
                  <option value="nextjs">Next.js</option>
                  <option value="static-html">Static HTML</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-brand-950">Content Directory</label>
                <input
                  type="text"
                  required
                  value={githubForm.contentDir}
                  onChange={(e) => setGithubForm({ ...githubForm, contentDir: e.target.value })}
                  className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  placeholder="e.g. src/app or content/blog"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-brand-950">Personal Access Token (PAT)</label>
                <input
                  type="password"
                  required
                  value={githubForm.accessToken}
                  onChange={(e) => setGithubForm({ ...githubForm, accessToken: e.target.value })}
                  className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  placeholder="ghp_..."
                />
                <p className="text-xs text-brand-500">Needs `repo` permissions to clone and open PRs.</p>
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setConnectingGitHub(false)}
                  className="px-4 py-2 text-sm font-medium text-brand-500 hover:text-brand-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectRepo.isPending}
                  className="inline-flex items-center justify-center rounded bg-brand-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
                >
                  {connectRepo.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
                  Connect GitHub
                </button>
              </div>
            </form>
          </Panel>
        )}
      </QueryState>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading integrations...</div>}>
      <IntegrationsClient />
    </Suspense>
  );
}
