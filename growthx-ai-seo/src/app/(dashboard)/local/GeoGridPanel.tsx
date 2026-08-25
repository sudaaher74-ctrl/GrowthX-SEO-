import { useState } from "react";
import { Panel, ActionButton } from "@/components/ui/console";
import { Map, Loader2 } from "lucide-react";
import { useRunGeoGridScan } from "@/hooks/use-growthx";
import type { GeoGridScanResult, GridNode } from "@/lib/api-client";

export function GeoGridPanel({ projectId, businessName }: { projectId: string | null; businessName?: string }) {
  const [keyword, setKeyword] = useState("");
  const [gridSize, setGridSize] = useState<3 | 5>(3);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [scanResult, setScanResult] = useState<GeoGridScanResult | null>(null);

  const scanMutation = useRunGeoGridScan(projectId);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    scanMutation.mutate(
      { keyword, businessName, gridSize, radiusKm },
      {
        onSuccess: (data) => setScanResult(data),
      }
    );
  };

  const getRankColor = (rank: number) => {
    if (rank >= 1 && rank <= 3) return "bg-green-500 text-white";
    if (rank >= 4 && rank <= 10) return "bg-yellow-400 text-yellow-950";
    return "bg-red-500 text-white";
  };

  // Sort nodes to render in a grid (row by row)
  const sortedNodes = scanResult?.nodes.sort((a, b) => {
    if (a.row === b.row) return a.col - b.col;
    return a.row - b.row;
  });

  return (
    <Panel
      title="GeoGrid Tracking"
      subtitle="Visualize local rankings across a geographic area."
    >
      <div className="p-4 space-y-6">
        <form onSubmit={handleScan} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Target Keyword</label>
            <input
              type="text"
              placeholder="e.g. 'plumber near me'"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full h-9 rounded-md border border-brand-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Grid Size</label>
            <select
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value) as 3 | 5)}
              className="h-9 rounded-md border border-brand-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value={3}>3x3 (9 nodes)</option>
              <option value={5}>5x5 (25 nodes)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Radius (km)</label>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="h-9 rounded-md border border-brand-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value={1}>1 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={20}>20 km</option>
            </select>
          </div>
          <ActionButton
            variant="primary"
            icon={scanMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Map size={12} />}
            disabled={scanMutation.isPending || !keyword.trim()}
          >
            {scanMutation.isPending ? "Scanning Area..." : "Run Scan"}
          </ActionButton>
        </form>

        {scanResult && (
          <div className="space-y-6 pt-4 border-t border-brand-200">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Grid Visualizer */}
              <div className="lg:col-span-1 flex flex-col items-center space-y-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ranking Heatmap</h3>
                <div 
                  className="grid gap-2 p-4 bg-brand-50 rounded-lg border border-brand-200"
                  style={{ gridTemplateColumns: `repeat(${scanResult.gridSize}, minmax(0, 1fr))` }}
                >
                  {sortedNodes?.map((node) => (
                    <div
                      key={node.id}
                      className={`w-12 h-12 flex flex-col items-center justify-center rounded-md text-sm font-bold shadow-sm ${getRankColor(node.rank)}`}
                      title={`Direction: ${node.direction}\nDistance: ${node.distanceKm}km\nLat: ${node.lat.toFixed(4)}, Lng: ${node.lng.toFixed(4)}`}
                    >
                      {node.rank === 21 ? '20+' : node.rank}
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 text-xs font-medium text-[var(--text-muted)]">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> 1-3</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-400 rounded-sm"></div> 4-10</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> 11+</div>
                </div>
              </div>

              {/* Action Plan */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 bg-brand-50 rounded border border-brand-100">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Avg Rank</p>
                    <p className="text-lg font-bold">{scanResult.metrics.averageGridRank.toFixed(1)}</p>
                  </div>
                  <div className="p-3 bg-brand-50 rounded border border-brand-100">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Top 3 Dominance</p>
                    <p className="text-lg font-bold">{scanResult.metrics.top3DominancePercentage.toFixed(0)}%</p>
                  </div>
                  <div className="p-3 bg-brand-50 rounded border border-brand-100">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Top 1 Spots</p>
                    <p className="text-lg font-bold">{scanResult.metrics.top1Count}</p>
                  </div>
                  <div className="p-3 bg-brand-50 rounded border border-brand-100">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Unranked</p>
                    <p className="text-lg font-bold">{scanResult.metrics.unrankedCount}</p>
                  </div>
                </div>

                <div className="bg-brand-950 text-white rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-brand-200 mb-2 flex items-center gap-2">
                    <Zap size={14} className="text-accent-400" />
                    AI Geo Action Plan
                  </h3>
                  <p className="text-sm leading-relaxed mb-4 text-brand-100">
                    {scanResult.aiGeoActionPlan.diagnosis}
                  </p>
                  
                  {scanResult.aiGeoActionPlan.keyVulnerabilities.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-brand-300 mb-2 uppercase tracking-wider">Vulnerabilities</p>
                      <ul className="list-disc list-inside text-sm space-y-1 text-brand-100">
                        {scanResult.aiGeoActionPlan.keyVulnerabilities.map((vuln, i) => (
                          <li key={i}>{vuln}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-brand-300 mb-2 uppercase tracking-wider">Recommended Actions</p>
                    <div className="space-y-3">
                      {scanResult.aiGeoActionPlan.actionItems.map((action, i) => (
                        <div key={i} className="bg-brand-900 rounded p-3 border border-brand-800">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm">{action.action}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              action.impact === 'HIGH' ? 'bg-red-500/20 text-red-300' :
                              action.impact === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-green-500/20 text-green-300'
                            }`}>
                              {action.impact} IMPACT
                            </span>
                          </div>
                          <p className="text-xs text-brand-200 mb-1">Target Zone: <span className="font-mono text-brand-100">{action.targetZone}</span></p>
                          <p className="text-xs text-brand-300">{action.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
