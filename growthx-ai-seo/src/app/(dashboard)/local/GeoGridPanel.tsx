import { useState } from "react";
import { Panel, ActionButton } from "@/components/ui/console";
import { Map, Loader2, Zap, Trophy, Compass, Star, ExternalLink } from "lucide-react";
import { useRunGeoGridScan } from "@/hooks/use-growthx";
import type { GeoGridScanResult, GridNode } from "@/lib/api-client";

export function GeoGridPanel({ projectId, businessName }: { projectId: string | null; businessName?: string }) {
  const [keyword, setKeyword] = useState("");
  const [gridSize, setGridSize] = useState<3 | 5>(3);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [scanResult, setScanResult] = useState<GeoGridScanResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const scanMutation = useRunGeoGridScan(projectId);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    scanMutation.mutate(
      { keyword, businessName, gridSize, radiusKm },
      {
        onSuccess: (data) => {
          setScanResult(data);
          // Default selection to center node
          if (data.nodes && data.nodes.length > 0) {
            const center = data.nodes.find((n: GridNode) => n.distanceKm === 0) || data.nodes[Math.floor(data.nodes.length / 2)];
            setSelectedNodeId(center ? center.id : data.nodes[0].id);
          }
        },
      }
    );
  };

  const getRankColor = (rank: number, isSelected: boolean) => {
    let base = "";
    if (rank >= 1 && rank <= 3) {
      base = "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/20";
    } else if (rank >= 4 && rank <= 10) {
      base = "bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-amber-500/20";
    } else {
      base = "bg-rose-500 text-white hover:bg-rose-400 shadow-rose-500/20";
    }

    if (isSelected) {
      return `${base} ring-4 ring-brand-950 dark:ring-white scale-110 z-10 shadow-lg`;
    }
    return `${base} hover:scale-105`;
  };

  // Sort nodes to render in a grid (row by row)
  const sortedNodes = scanResult?.nodes ? [...scanResult.nodes].sort((a, b) => {
    if (a.row === b.row) return a.col - b.col;
    return a.row - b.row;
  }) : [];

  const selectedNode = scanResult?.nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <Panel
      title="GeoGrid Tracking & Proximity Heatmap"
      subtitle="Analyze neighborhood-level Google Maps 3-Pack rankings and click nodes to inspect top local rivals."
    >
      <div className="p-4 space-y-6">
        <form onSubmit={handleScan} className="flex flex-wrap gap-4 items-end bg-brand-50/40 p-4 rounded-xl border border-brand-200">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-brand-700 mb-1.5">Target Local Keyword</label>
            <input
              type="text"
              placeholder="e.g. 'hvac repair near me' or 'emergency dental'"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full h-9 rounded-md border border-brand-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-700 mb-1.5">Grid Resolution</label>
            <select
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value) as 3 | 5)}
              className="h-9 rounded-md border border-brand-200 bg-white px-3 py-1 text-sm shadow-sm"
            >
              <option value={3}>3x3 (9 nodes - Fast)</option>
              <option value={5}>5x5 (25 nodes - High Res)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-700 mb-1.5">Scan Radius</label>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="h-9 rounded-md border border-brand-200 bg-white px-3 py-1 text-sm shadow-sm"
            >
              <option value={1}>1 km (Dense Urban)</option>
              <option value={5}>5 km (Suburban)</option>
              <option value={10}>10 km (Metro Trade Area)</option>
              <option value={20}>20 km (Regional)</option>
            </select>
          </div>
          <ActionButton
            variant="primary"
            icon={scanMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Map size={13} />}
            disabled={scanMutation.isPending || !keyword.trim()}
          >
            {scanMutation.isPending ? "Running Geo-Grid..." : "Scan Ranking Grid"}
          </ActionButton>
        </form>

        {scanResult && (
          <div className="space-y-6 pt-2">
            {/* Top Stat Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3.5 bg-brand-50/70 rounded-lg border border-brand-200">
                <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">Avg Grid Rank</p>
                <p className="text-xl font-bold font-mono text-brand-950">#{scanResult.metrics.averageGridRank.toFixed(1)}</p>
              </div>
              <div className="p-3.5 bg-emerald-50/80 rounded-lg border border-emerald-200">
                <p className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider mb-1">3-Pack Dominance</p>
                <p className="text-xl font-bold font-mono text-emerald-900">{scanResult.metrics.top3DominancePercentage.toFixed(0)}%</p>
              </div>
              <div className="p-3.5 bg-brand-50/70 rounded-lg border border-brand-200">
                <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">#1 Positions</p>
                <p className="text-xl font-bold font-mono text-brand-950">{scanResult.metrics.top1Count} nodes</p>
              </div>
              <div className="p-3.5 bg-brand-50/70 rounded-lg border border-brand-200">
                <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">Top 10 Nodes</p>
                <p className="text-xl font-bold font-mono text-brand-950">{scanResult.metrics.top10Count} nodes</p>
              </div>
              <div className="p-3.5 bg-rose-50/80 rounded-lg border border-rose-200">
                <p className="text-[11px] font-medium text-rose-800 uppercase tracking-wider mb-1">Outside Top 20</p>
                <p className="text-xl font-bold font-mono text-rose-900">{scanResult.metrics.unrankedCount} nodes</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Heatmap Grid Interactive Visualizer */}
              <div className="lg:col-span-5 flex flex-col items-center p-5 bg-brand-50/50 rounded-xl border border-brand-200">
                <div className="w-full flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-brand-950">Interactive Grid Map</h3>
                    <p className="text-[11.5px] text-brand-500">Click any coordinate pin to inspect competitors</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-brand-200/70 text-brand-800 px-2 py-0.5 rounded font-semibold">
                    {scanResult.radiusKm}km radius
                  </span>
                </div>

                <div 
                  className="grid gap-2.5 p-4 bg-white rounded-xl border border-brand-200 shadow-sm"
                  style={{ gridTemplateColumns: `repeat(${scanResult.gridSize}, minmax(0, 1fr))` }}
                >
                  {sortedNodes?.map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    return (
                      <button
                        type="button"
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg text-sm font-extrabold cursor-pointer transition-all duration-150 relative ${getRankColor(node.rank, isSelected)}`}
                        title={`[${node.direction}] Distance: ${node.distanceKm}km\nRank: #${node.rank}\nClick to inspect competitors`}
                      >
                        <span>{node.rank > 20 ? '20+' : `#${node.rank}`}</span>
                        <span className="text-[8px] font-mono tracking-tighter opacity-85">{node.direction.split('-').map(p => p[0]).join('')}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-5 mt-4 text-[11px] font-medium text-brand-600">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-emerald-600 rounded-sm"></div>
                    <span>Rank 1-3 (3-Pack)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-amber-400 rounded-sm"></div>
                    <span>Rank 4-10</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-rose-500 rounded-sm"></div>
                    <span>Rank 11+</span>
                  </div>
                </div>
              </div>

              {/* Node Deep Dive & Competitor Inspector */}
              <div className="lg:col-span-7 space-y-4">
                {selectedNode ? (
                  <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm space-y-4">
                    <div className="flex items-start justify-between border-b border-brand-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Compass size={16} className="text-accent-600" />
                          <h4 className="text-sm font-bold text-brand-950">
                            Coordinate Inspector: {selectedNode.direction} ({selectedNode.distanceKm} km from center)
                          </h4>
                        </div>
                        <p className="text-[11.5px] font-mono text-brand-500 mt-0.5">
                          GPS: {selectedNode.lat.toFixed(5)}, {selectedNode.lng.toFixed(5)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold ${
                          selectedNode.rank <= 3 ? 'bg-emerald-100 text-emerald-800' :
                          selectedNode.rank <= 10 ? 'bg-amber-100 text-amber-900' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          Your Position: #{selectedNode.rank > 20 ? '20+' : selectedNode.rank}
                        </span>
                      </div>
                    </div>

                    {/* Competitor list at this coordinate */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-brand-500 mb-2.5 flex items-center gap-1.5">
                        <Trophy size={13} className="text-amber-500" />
                        Top Competitors Dominating This Coordinate
                      </p>

                      {selectedNode.topCompetitors && selectedNode.topCompetitors.length > 0 ? (
                        <div className="space-y-2">
                          {selectedNode.topCompetitors.map((comp, idx) => {
                            const isUserBusiness = comp.name.toLowerCase() === (businessName || "").toLowerCase();
                            return (
                              <div
                                key={idx}
                                className={`flex items-center justify-between p-3 rounded-lg border text-xs transition-colors ${
                                  isUserBusiness
                                    ? 'bg-accent-50/60 border-accent-300 ring-1 ring-accent-400'
                                    : 'bg-brand-50/40 border-brand-200 hover:bg-brand-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                    comp.rank === 1 ? 'bg-amber-400 text-amber-950' :
                                    comp.rank === 2 ? 'bg-slate-300 text-slate-900' :
                                    'bg-amber-700/80 text-white'
                                  }`}>
                                    #{comp.rank}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-brand-950 text-[12.5px]">{comp.name}</span>
                                      {isUserBusiness && (
                                        <span className="text-[10px] bg-accent-600 text-white px-1.5 py-0.2 rounded font-semibold">
                                          Your Profile
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-brand-500 mt-0.5">
                                      {comp.rating !== undefined && (
                                        <span className="flex items-center gap-1 font-medium text-brand-700">
                                          <Star size={11} className="text-amber-500 fill-amber-500" />
                                          {comp.rating.toFixed(1)}
                                        </span>
                                      )}
                                      {comp.reviewsCount !== undefined && (
                                        <span>{comp.reviewsCount.toLocaleString()} reviews</span>
                                      )}
                                      {comp.distanceKm !== undefined && (
                                        <span>{comp.distanceKm} km away</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(comp.name)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-400 hover:text-accent-600 p-1.5 rounded-md hover:bg-white"
                                  title="Search on Google Maps"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-center bg-brand-50/50 rounded-lg text-xs text-brand-500">
                          No competitor breakdown captured for this specific coordinate.
                        </div>
                      )}
                    </div>

                    {/* Coordinate Specific Recommendation */}
                    <div className="p-3 bg-brand-50 rounded-lg border border-brand-200/80 text-xs">
                      <span className="font-bold text-brand-800">Zone Strategy: </span>
                      <span className="text-brand-600 leading-relaxed">
                        {selectedNode.rank <= 3
                          ? `You hold a prime Google Maps 3-Pack spot in this ${selectedNode.direction} sector. Protect it by actively maintaining a steady review flow from customers in this neighborhood.`
                          : selectedNode.rank <= 10
                          ? `High opportunity striking zone. You are ranking #${selectedNode.rank}. Acquiring 3-5 localized reviews mentioning keywords in this quadrant can move you into the top 3.`
                          : `High proximity deficit. Local competitors in this quadrant have stronger citation signals. Create localized service area pages targeting this sector.`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-brand-200 p-8 text-center text-xs text-brand-500">
                    Click any node in the heatmap to inspect local competitors and rankings at that coordinate.
                  </div>
                )}

                {/* AI Geo Action Plan diagnosis */}
                <div className="bg-brand-950 text-white rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-brand-200 mb-2 flex items-center gap-2">
                    <Zap size={15} className="text-accent-400" />
                    AI Geo Action Plan
                  </h3>
                  <p className="text-xs leading-relaxed mb-4 text-brand-100">
                    {scanResult.aiGeoActionPlan.diagnosis}
                  </p>
                  
                  {scanResult.aiGeoActionPlan.keyVulnerabilities.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold text-brand-300 mb-1.5 uppercase tracking-wider">Key Vulnerabilities</p>
                      <ul className="list-disc list-inside text-xs space-y-1 text-brand-200">
                        {scanResult.aiGeoActionPlan.keyVulnerabilities.map((vuln, i) => (
                          <li key={i}>{vuln}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold text-brand-300 mb-2 uppercase tracking-wider">Recommended Proximity Actions</p>
                    <div className="space-y-2.5">
                      {scanResult.aiGeoActionPlan.actionItems.map((action, i) => (
                        <div key={i} className="bg-brand-900/90 rounded-lg p-3 border border-brand-800/80">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs text-white">{action.action}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              action.impact === 'HIGH' ? 'bg-rose-500/25 text-rose-300' :
                              action.impact === 'MEDIUM' ? 'bg-amber-500/25 text-amber-300' :
                              'bg-emerald-500/25 text-emerald-300'
                            }`}>
                              {action.impact} IMPACT
                            </span>
                          </div>
                          <p className="text-[11px] text-brand-300 mb-1">Target Zone: <span className="font-mono text-brand-100 font-semibold">{action.targetZone}</span></p>
                          <p className="text-xs text-brand-200">{action.description}</p>
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
