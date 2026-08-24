"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Sparkles,
  RefreshCw,
  Search,
  Crosshair,
  Compass,
  Trophy,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Info,
  ChevronRight,
  Sliders,
  Layers,
  Star,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader, ActionButton } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";

interface GridNode {
  id: string;
  row: number;
  col: number;
  lat: number;
  lng: number;
  distanceKm: number;
  direction: string;
  rank: number;
  businessFound: boolean;
  topCompetitors: {
    name: string;
    rank: number;
    rating?: number;
    reviewsCount?: number;
  }[];
}

interface GeoGridScanResult {
  keyword: string;
  businessName: string;
  centerCoordinates: { lat: number; lng: number };
  gridSize: number;
  radiusKm: number;
  scannedAt: string;
  metrics: {
    averageGridRank: number;
    top3DominancePercentage: number;
    top1Count: number;
    top3Count: number;
    top10Count: number;
    unrankedCount: number;
  };
  nodes: GridNode[];
  aiGeoActionPlan: {
    diagnosis: string;
    keyVulnerabilities: string[];
    actionItems: {
      action: string;
      impact: "HIGH" | "MEDIUM" | "LOW";
      targetZone: string;
      description: string;
    }[];
  };
  model?: string;
}

const PRESET_KEYWORDS = [
  "best local service",
  "luxury jewellery store",
  "emergency dentist",
  "digital marketing agency",
  "coffee shop near me",
];

export default function GeoTrackingPage() {
  const { projectId } = useWorkspace();
  const [keyword, setKeyword] = useState("luxury jewellery store");
  const [businessName, setBusinessName] = useState("");
  const [gridSize, setGridSize] = useState<3 | 5>(3);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [selectedNode, setSelectedNode] = useState<GridNode | null>(null);

  // Load connected local business name if available
  const localListing = useQuery({
    queryKey: ["local-seo-listing", projectId],
    queryFn: () => (projectId ? api.getLocalSeo(projectId) : null),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (localListing.data?.businessName && !businessName) {
      setBusinessName(localListing.data.businessName);
    }
  }, [localListing.data, businessName]);

  const scanMut = useMutation({
    mutationFn: async (): Promise<GeoGridScanResult | null> => {
      if (!projectId || !keyword.trim()) return null;
      return api.runGeoGridScan(projectId, {
        keyword: keyword.trim(),
        businessName: businessName.trim() || undefined,
        gridSize,
        radiusKm,
      });
    },
    onSuccess: (data) => {
      if (data?.nodes && data.nodes.length > 0) {
        // Select the center node by default
        const center = data.nodes.find((n) => n.distanceKm === 0) || data.nodes[0];
        setSelectedNode(center);
      }
    },
  });

  // Automatically trigger an initial scan when workspace is loaded
  useEffect(() => {
    if (projectId && !scanMut.data && !scanMut.isPending) {
      scanMut.mutate();
    }
  }, [projectId]);

  const data = scanMut.data;

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return "bg-emerald-500 text-white ring-4 ring-emerald-100 shadow-md shadow-emerald-500/20";
    if (rank <= 3) return "bg-emerald-600 text-white ring-2 ring-emerald-100";
    if (rank <= 9) return "bg-amber-500 text-white ring-2 ring-amber-100";
    if (rank <= 19) return "bg-orange-500 text-white ring-2 ring-orange-100";
    return "bg-rose-500 text-white ring-2 ring-rose-100";
  };

  const getRankTextColor = (rank: number) => {
    if (rank <= 3) return "text-emerald-600";
    if (rank <= 9) return "text-amber-600";
    if (rank <= 19) return "text-orange-600";
    return "text-rose-600";
  };

  return (
    <div className="flex-1 overflow-y-auto bg-brand-50">
      <PageHeader
        title="Local Geo-Grid Map Pack Tracker"
        subtitle="Simulate and track your Google Maps rankings across a live multi-point geo-coordinate matrix."
      />

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Search & Config Bar */}
        <div className="bg-white rounded-xl border border-brand-200 p-6 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-brand-950">Geo-Grid Ranking Scan</h3>
                <p className="text-[12px] text-brand-500 mt-0.5">
                  Track how your business ranks in Google Local 3-Packs at specific distance nodes around your location.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-brand-500 uppercase tracking-wider">Quick Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_KEYWORDS.slice(0, 3).map((kw) => (
                    <button
                      key={kw}
                      onClick={() => setKeyword(kw)}
                      className="px-2.5 py-1 rounded-md text-[11px] bg-brand-100 text-brand-700 hover:bg-brand-200 transition"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Target Keyword */}
              <div className="md:col-span-4">
                <label htmlFor="target-local-keyword" className="text-[11px] font-medium text-brand-500 mb-1.5 block uppercase tracking-wider">
                  Target Local Keyword
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search size={14} className="text-brand-400" />
                  </div>
                  <input id="target-local-keyword"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="e.g. luxury jewellery store"
                    className="pl-9 h-10 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-[13px] text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  />
                </div>
              </div>

              {/* Business Name */}
              <div className="md:col-span-3">
                <label htmlFor="business-name-optional" className="text-[11px] font-medium text-brand-500 mb-1.5 block uppercase tracking-wider">
                  Business Name (Optional)
                </label>
                <input id="business-name-optional"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Tanishq Jewellery"
                  className="h-10 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-[13px] text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                />
              </div>

              {/* Grid Size */}
              <div className="md:col-span-2">
                <span id="grid-size-label" className="text-[11px] font-medium text-brand-500 mb-1.5 block uppercase tracking-wider">
                  Grid Size
                </span>
                <div role="group" aria-labelledby="grid-size-label" className="flex rounded-md border border-brand-200 p-0.5 bg-brand-100">
                  <button
                    onClick={() => setGridSize(3)}
                    className={`flex-1 py-1.5 text-[12px] font-medium rounded transition ${
                      gridSize === 3 ? "bg-white text-brand-950 shadow-sm" : "text-brand-500 hover:text-brand-950"
                    }`}
                  >
                    3x3 (9 pts)
                  </button>
                  <button
                    onClick={() => setGridSize(5)}
                    className={`flex-1 py-1.5 text-[12px] font-medium rounded transition ${
                      gridSize === 5 ? "bg-white text-brand-950 shadow-sm" : "text-brand-500 hover:text-brand-950"
                    }`}
                  >
                    5x5 (25 pts)
                  </button>
                </div>
              </div>

              {/* Radius */}
              <div className="md:col-span-1">
                <label htmlFor="radius" className="text-[11px] font-medium text-brand-500 mb-1.5 block uppercase tracking-wider">
                  Radius
                </label>
                <select id="radius"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full h-10 rounded-md border border-brand-200 bg-white px-2 py-2 text-[13px] text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                >
                  <option value={2}>2 km</option>
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={20}>20 km</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="md:col-span-2">
                <ActionButton
                  onClick={() => scanMut.mutate()}
                  disabled={!keyword.trim() || scanMut.isPending}
                  className="h-10 w-full justify-center gap-2"
                >
                  {scanMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Crosshair size={14} />}
                  Run Geo Scan
                </ActionButton>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Animation */}
        {scanMut.isPending && (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl bg-emerald-500/20 animate-pulse" />
              <Crosshair className="relative text-emerald-600 animate-spin" size={40} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-brand-950">Simulating Geo-Grid Local Coordinates...</p>
              <p className="text-[12px] text-brand-500 mt-1">
                Calculating {gridSize * gridSize} coordinate nodes across a {radiusKm}km radius and retrieving Map Pack ranks.
              </p>
            </div>
          </div>
        )}

        {/* Main Dashboard Results */}
        {data && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* KPI Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">Average Grid Rank (AGR)</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${getRankTextColor(data.metrics.averageGridRank)}`}>
                    #{data.metrics.averageGridRank}
                  </span>
                  <span className="text-[12px] text-brand-500">across {data.nodes.length} nodes</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">Top 3 Dominance (SoV)</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${data.metrics.top3DominancePercentage >= 60 ? "text-emerald-600" : "text-amber-600"}`}>
                    {data.metrics.top3DominancePercentage}%
                  </span>
                  <span className="text-[12px] text-brand-500">Map Pack Share</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">#1 Positions Held</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-emerald-600">{data.metrics.top1Count}</span>
                  <span className="text-[12px] text-brand-500">of {data.nodes.length} locations</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">Coverage Radius</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-brand-950">{data.radiusKm} km</span>
                  <span className="text-[12px] text-brand-500">({data.gridSize}x{data.gridSize} matrix)</span>
                </div>
              </div>
            </div>

            {/* Visual Grid & Node Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Map Heatmap Canvas (Left 7 Cols) */}
              <div className="lg:col-span-7 bg-white rounded-xl border border-brand-200 p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass size={16} className="text-brand-950" />
                    <h3 className="text-sm font-semibold text-brand-950">
                      Interactive Geo-Grid Canvas ({data.gridSize}x{data.gridSize})
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-brand-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Top 3
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> 4-9
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> 10-19
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> 20+
                    </span>
                  </div>
                </div>

                {/* Radar Map Canvas Overlay */}
                <div className="relative aspect-square max-w-lg mx-auto bg-slate-900 rounded-2xl p-6 overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
                  {/* Radar concentric distance circles */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <div className="w-[85%] h-[85%] rounded-full border border-emerald-400 border-dashed" />
                    <div className="w-[55%] h-[55%] rounded-full border border-emerald-400 border-dashed" />
                    <div className="w-[25%] h-[25%] rounded-full border border-emerald-400" />
                    <div className="absolute w-full h-[1px] bg-emerald-400/40" />
                    <div className="absolute h-full w-[1px] bg-emerald-400/40" />
                  </div>

                  {/* Cardinal direction labels */}
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 tracking-widest">
                    NORTH
                  </span>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 tracking-widest">
                    SOUTH
                  </span>
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 tracking-widest">
                    WEST
                  </span>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 tracking-widest">
                    EAST
                  </span>

                  {/* Grid Matrix Pins */}
                  <div
                    className="relative z-10 grid gap-4 w-full h-full p-4"
                    style={{
                      gridTemplateColumns: `repeat(${data.gridSize}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${data.gridSize}, minmax(0, 1fr))`,
                    }}
                  >
                    {data.nodes.map((node) => {
                      const isSelected = selectedNode?.id === node.id;
                      const isCenter = node.distanceKm === 0;

                      return (
                        <motion.button
                          key={node.id}
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedNode(node)}
                          className={`relative flex items-center justify-center m-auto rounded-full font-bold text-[13px] transition cursor-pointer ${
                            data.gridSize === 5 ? "w-10 h-10 text-[11px]" : "w-14 h-14"
                          } ${getRankBadgeStyle(node.rank)} ${
                            isSelected ? "ring-4 ring-white ring-offset-2 ring-offset-slate-900 z-20" : ""
                          }`}
                        >
                          {node.rank > 20 ? "20+" : node.rank}
                          {isCenter && (
                            <span className="absolute -top-1.5 -right-1 px-1 py-0.2 bg-white text-slate-900 rounded-full text-[8px] font-extrabold uppercase border shadow">
                              HQ
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[12px] text-brand-500 bg-brand-50 p-3 rounded-lg border border-brand-100">
                  <p>Click any coordinate pin to inspect the local 3-pack competitors at that node.</p>
                  <span className="font-mono text-brand-950">Radius: {data.radiusKm} km</span>
                </div>
              </div>

              {/* Node Inspector (Right 5 Cols) */}
              <div className="lg:col-span-5 space-y-6">
                {selectedNode ? (
                  <div className="bg-white rounded-xl border border-brand-200 p-6 shadow-sm space-y-5">
                    <div className="flex items-center justify-between border-b border-brand-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <MapPin size={16} className="text-blue-600" />
                          <h4 className="text-sm font-semibold text-brand-950">
                            Node Inspector ({selectedNode.direction})
                          </h4>
                        </div>
                        <p className="text-[11px] text-brand-500 mt-0.5">
                          {selectedNode.distanceKm === 0
                            ? "Physical Business Center (HQ)"
                            : `${selectedNode.distanceKm} km from Center`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-brand-500 block uppercase font-semibold">Rank at this Pin</span>
                        <span className={`text-2xl font-bold ${getRankTextColor(selectedNode.rank)}`}>
                          #{selectedNode.rank > 20 ? "20+" : selectedNode.rank}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] text-brand-500">
                      <p>
                        Coordinates: <code className="text-brand-950 font-mono">{selectedNode.lat}, {selectedNode.lng}</code>
                      </p>
                    </div>

                    {/* Simulated Map Pack Results */}
                    <div className="space-y-3 pt-2">
                      <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Local 3-Pack at this spot</span>
                        <span className="text-emerald-600">Simulated SERP</span>
                      </p>

                      <div className="space-y-2">
                        {selectedNode.topCompetitors.map((comp, i) => {
                          const isClient = comp.name.toLowerCase().includes(data.businessName.toLowerCase());
                          return (
                            <div
                              key={i}
                              className={`p-3 rounded-lg border flex items-center justify-between ${
                                isClient
                                  ? "bg-emerald-50/70 border-emerald-200"
                                  : "bg-brand-50 border-brand-100"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                    comp.rank === 1
                                      ? "bg-emerald-500 text-white"
                                      : comp.rank === 2
                                      ? "bg-emerald-600 text-white"
                                      : "bg-amber-500 text-white"
                                  }`}
                                >
                                  {comp.rank}
                                </div>
                                <div>
                                  <p className="text-[13px] font-semibold text-brand-950 flex items-center gap-1.5">
                                    {comp.name}
                                    {isClient && (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-800 text-[10px] font-bold">
                                        YOU
                                      </span>
                                    )}
                                  </p>
                                  <div className="flex items-center gap-2 text-[11px] text-brand-500 mt-0.5">
                                    <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                                      <Star size={10} className="fill-amber-400" />
                                      {comp.rating}
                                    </span>
                                    <span>({comp.reviewsCount} reviews)</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-brand-200 p-12 text-center text-brand-500 text-[13px]">
                    Select a node pin on the map to inspect competitors.
                  </div>
                )}

                {/* AI Geo Diagnosis Box */}
                <div className="bg-gradient-to-br from-indigo-50/80 to-blue-50/50 rounded-xl border border-indigo-100 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-600" />
                    <h4 className="text-[13px] font-semibold text-indigo-950">AI Heatmap Diagnosis</h4>
                  </div>
                  <p className="text-[12px] text-slate-700 leading-relaxed">
                    {data.aiGeoActionPlan.diagnosis}
                  </p>
                </div>
              </div>
            </div>

            {/* Actionable Geo-Dominance Plan */}
            <div className="bg-white rounded-xl border border-brand-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-brand-100 pb-4">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-amber-500" />
                  <h3 className="text-sm font-semibold text-brand-950">
                    AI Geo-Dominance Expansion Plan
                  </h3>
                </div>
                <span className="text-[11px] text-brand-500">Targeting Peripheral & Red Zones</span>
              </div>

              {/* Vulnerabilities */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">
                  Identified Proximity Bottlenecks
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {data.aiGeoActionPlan.keyVulnerabilities.map((vuln, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/70 text-[12px] text-amber-900 flex items-start gap-2"
                    >
                      <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                      <span>{vuln}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Items */}
              <div className="space-y-3 pt-2">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">
                  Recommended Geo Optimization Tasks
                </p>
                <div className="space-y-3">
                  {data.aiGeoActionPlan.actionItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-brand-200 bg-brand-50 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-brand-400 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.impact === "HIGH"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {item.impact} IMPACT
                          </span>
                          <span className="text-[11px] text-brand-500 font-medium">
                            Zone: <strong>{item.targetZone}</strong>
                          </span>
                        </div>
                        <h4 className="text-[13px] font-semibold text-brand-950">{item.action}</h4>
                        <p className="text-[12px] text-brand-500">{item.description}</p>
                      </div>
                      <button className="px-3 py-1.5 rounded-lg bg-white border border-brand-200 text-[12px] font-medium text-brand-950 hover:bg-brand-100 transition shrink-0 self-start md:self-auto flex items-center gap-1">
                        <span>Apply Task</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
