"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Radar, Search, Star } from "lucide-react";

import { ActionButton, Kpi, PageHeader, Panel, Pill, StatusNote } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { useWorkspace } from "@/hooks/use-growthx";
import { api, type GeoGridScanResult, type GeoGridRunSummary, type LocalSeoData } from "@/lib/api-client";

type PlaceResult = {
  placeId: string;
  name: string;
  address: string;
  rating: number;
  userRatingsTotal: number;
  latitude?: number;
  longitude?: number;
};

const GRID_SIZES = [3, 5, 7] as const;

export default function GoogleBusinessProfilePage() {
  const { projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [gridSize, setGridSize] = useState<3 | 5 | 7>(3);
  const [radiusKm, setRadiusKm] = useState(5);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [scan, setScan] = useState<GeoGridScanResult | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "warn" | "bad" | "info"; text: string } | null>(null);

  const location = useQuery<LocalSeoData | null>({
    queryKey: ["local-seo-primary", projectId],
    queryFn: async () => (await api.getLocalSeo(projectId!)) ?? null,
    enabled: Boolean(projectId),
    retry: false,
  });
  const history = useQuery<GeoGridRunSummary[]>({
    queryKey: ["local-seo-grid-history", projectId],
    queryFn: () => api.getGeoGridHistory(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
  const googleConnections = useQuery({
    queryKey: ["google-connections", projectId],
    queryFn: () => api.googleConnections(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
  const businessProfileConnection = googleConnections.data?.providers.find((provider) => provider.id === "business_profile");

  const search = useMutation({
    mutationFn: () => api.searchLocalBusiness(projectId!, searchText.trim()),
    onSuccess: (results) => {
      setPlaces(results);
      setNotice(results.length ? null : { tone: "warn", text: "Google Places returned no matches. Try the business name plus its city." });
    },
    onError: (error) => setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Google Places search failed." }),
  });
  const connect = useMutation({
    mutationFn: (place: PlaceResult) => api.connectLocalBusiness(projectId!, {
      businessName: place.name,
      address: place.address,
      rating: place.rating,
      reviewCount: place.userRatingsTotal,
      placeId: place.placeId,
      latitude: place.latitude,
      longitude: place.longitude,
    }),
    onSuccess: async () => {
      setPlaces([]);
      setNotice({ tone: "good", text: "The public Maps listing is linked to this workspace." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["local-seo-primary", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["local-seo-grid-history", projectId] }),
      ]);
    },
    onError: (error) => setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Could not link this listing." }),
  });
  const runScan = useMutation({
    mutationFn: () => api.runGeoGridScan(projectId!, {
      keyword: keyword.trim(),
      businessName: location.data?.businessName,
      lat: location.data?.latitude ?? undefined,
      lng: location.data?.longitude ?? undefined,
      address: location.data?.address,
      gridSize,
      radiusKm,
    }),
    onSuccess: async (result) => {
      setScan(result);
      setNotice({ tone: "good", text: `A ${result.gridSize} × ${result.gridSize} Google Places snapshot was saved.` });
      await queryClient.invalidateQueries({ queryKey: ["local-seo-grid-history", projectId] });
    },
    onError: (error) => setNotice({ tone: "bad", text: error instanceof Error ? error.message : "The map scan could not be completed." }),
  });

  const mapsUrl = useMemo(() => {
    const row = location.data;
    if (!row) return null;
    const params = new URLSearchParams({ api: "1", query: row.businessName });
    if (row.placeId) params.set("query_place_id", row.placeId);
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }, [location.data]);

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Google Business Profile"
        subtitle="Manage your local search presence with clearly sourced Maps listing data and location-based result snapshots."
      />

      {notice && <StatusNote tone={notice.tone}>{notice.text}</StatusNote>}

      <Panel title="Owner-managed profile connection" subtitle="This is separate from public Google Maps listing data." padded>
        {googleConnections.isLoading ? <p className="text-[12px] text-brand-500">Checking connection status…</p> : googleConnections.error ? <p className="text-[12px] text-brand-500">Connection status is unavailable right now.</p> : businessProfileConnection?.status === "CONNECTED" ? (
          <StatusNote tone="good">Google Business Profile access is connected for {businessProfileConnection.selectedResourceName || "a selected location"}. Owner metrics and profile editing are not available in this screen yet.</StatusNote>
        ) : businessProfileConnection?.requiresGoogleApproval ? (
          <StatusNote tone="info">Google requires approval for the Business Profile API before owner-only data can be connected. Public Maps listing lookup and location snapshots below are available separately.</StatusNote>
        ) : (
          <StatusNote tone="warn">No owner-managed Business Profile connection is active. The public Maps listing below does not grant access to private profile insights, replies, or editing.</StatusNote>
        )}
      </Panel>

      <Panel title="Your public Google Maps listing" subtitle="Public listing details from Google Places. This is separate from owner-only Business Profile data." padded>
        <QueryState
          isLoading={location.isLoading}
          error={location.error}
          isEmpty={!location.data}
          emptyTitle="No Maps listing linked yet"
          emptyBody="Search for your business and choose the correct Google Maps result. Reigel stores the public listing snapshot and uses its location as the centre for map scans."
          emptyAction={<span className="text-[11px] text-brand-500">Add a listing below</span>}
        >
          {location.data && (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[18px] font-semibold text-brand-950">{location.data.businessName}</h2>
                  <Pill tone="info">Public Maps data</Pill>
                </div>
                <p className="mt-1 text-[12px] text-brand-500">{location.data.address}</p>
                <p className="mt-2 text-[10.5px] text-brand-400">
                  Listing snapshot saved {new Date(location.data.updatedAt).toLocaleString()}. Rating and review count may have changed since then.
                </p>
              </div>
              {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold text-brand-700 hover:bg-brand-50">Open in Google Maps <ExternalLink size={13} /></a>}
            </div>
          )}
        </QueryState>
        {location.data && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Kpi label="Google Maps rating" value={location.data.reviewCount ? location.data.rating.toFixed(1) : "—"} aside={location.data.reviewCount ? <Star size={14} className="fill-warning-500 text-warning-500" /> : undefined} sub="Public listing snapshot" />
            <Kpi label="Public review count" value={location.data.reviewCount.toLocaleString()} sub="Count returned when this listing was linked" />
            <Kpi label="Map coordinates" value={location.data.latitude != null && location.data.longitude != null ? "Available" : "Missing"} sub={location.data.latitude != null && location.data.longitude != null ? "Used to centre location scans" : "A scan may need a location query"} />
          </div>
        )}
      </Panel>

      {!location.data && (
        <Panel title="Find your business on Google Maps" subtitle="Search results come from Google Places. Select the exact business and address." padded>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (projectId && searchText.trim()) search.mutate(); }}>
            <label className="sr-only" htmlFor="business-search">Business name and location</label>
            <input id="business-search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Business name and city" className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-[13px] text-brand-900 placeholder:text-brand-400" />
            <ActionButton type="submit" variant="primary" icon={<Search size={14} />} disabled={!projectId || !searchText.trim() || search.isPending}>{search.isPending ? "Searching…" : "Search Google Maps"}</ActionButton>
          </form>
          {places.length > 0 && <div className="mt-3 divide-y rounded-xl border">
            {places.map((place) => <div key={place.placeId} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="text-[13px] font-semibold text-brand-950">{place.name}</p><p className="text-[11px] text-brand-500">{place.address}</p><p className="mt-1 text-[10px] text-brand-400">Google Places · {place.rating ? `${place.rating.toFixed(1)} ★ · ${place.userRatingsTotal.toLocaleString()} public reviews` : "No public rating returned"}</p></div>
              <ActionButton variant="secondary" disabled={connect.isPending} onClick={() => connect.mutate(place)}>{connect.isPending ? "Linking…" : "Use this listing"}</ActionButton>
            </div>)}
          </div>}
        </Panel>
      )}

      <Panel title="Local result visibility" subtitle="Take a point-in-time sample of Google Places results around your listing." padded>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
          <div><label htmlFor="local-keyword" className="mb-1 block text-[11px] font-medium text-brand-600">Search phrase</label><input id="local-keyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="e.g. fresh milk delivery" className="w-full rounded-lg border bg-white px-3 py-2 text-[12px] text-brand-900 placeholder:text-brand-400" /></div>
          <div><label htmlFor="grid-size" className="mb-1 block text-[11px] font-medium text-brand-600">Map points</label><select id="grid-size" value={gridSize} onChange={(event) => setGridSize(Number(event.target.value) as 3 | 5 | 7)} className="rounded-lg border bg-white px-3 py-2 text-[12px] text-brand-900">{GRID_SIZES.map((size) => <option key={size} value={size}>{size} × {size}</option>)}</select></div>
          <div><label htmlFor="scan-radius" className="mb-1 block text-[11px] font-medium text-brand-600">Area radius</label><select id="scan-radius" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} className="rounded-lg border bg-white px-3 py-2 text-[12px] text-brand-900">{[2, 5, 10, 15].map((radius) => <option key={radius} value={radius}>{radius} km</option>)}</select></div>
          <ActionButton variant="primary" icon={<Radar size={14} />} disabled={!projectId || !location.data || !keyword.trim() || runScan.isPending} onClick={() => runScan.mutate()}>{runScan.isPending ? "Scanning…" : "Run map scan"}</ActionButton>
        </div>
        <p className="mt-3 text-[10.5px] leading-5 text-brand-400">{location.data ? "This is a Google Places API snapshot at the selected map points. It is not a Google Search ranking, a Google Search Console metric, or a promise of what every person will see." : "Link your public Maps listing above before running a scan, so the results are centred on its saved location."}</p>
      </Panel>

      {scan && <Panel title={`Map snapshot: “${scan.keyword}”`} subtitle={`Measured ${new Date(scan.scannedAt).toLocaleString()} · Source: ${scan.source}`} actions={<Pill tone="info">{scan.gridSize} × {scan.gridSize} · {scan.radiusKm} km</Pill>}>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Kpi label="Average observed position" value={scan.metrics.averageGridRank == null ? "Not found" : `#${scan.metrics.averageGridRank.toFixed(1)}`} sub="Average over points where your listing appeared" />
          <Kpi label="Points in top 3" value={`${scan.metrics.top3Count} / ${scan.nodes.length}`} sub="From the Places results returned for this scan" />
          <Kpi label="Not in returned sample" value={String(scan.metrics.unrankedCount)} sub="No position in the results returned at these points" />
        </div>
        <div className="grid gap-2 px-4 pb-4" style={{ gridTemplateColumns: `repeat(${scan.gridSize}, minmax(0, 1fr))` }}>
          {scan.nodes.map((node) => <div key={node.id} className={`flex min-h-16 flex-col items-center justify-center rounded-lg border p-2 text-center ${node.rank == null ? "bg-brand-50 text-brand-500" : node.rank <= 3 ? "border-success-200 bg-success-50 text-success-700" : node.rank <= 10 ? "border-warning-200 bg-warning-50 text-warning-700" : "border-accent-200 bg-accent-50 text-accent-700"}`}>
            <span className="font-mono text-[16px] font-bold">{node.rank != null ? `#${node.rank}` : "—"}</span>
            <span className="mt-0.5 text-[9px]">{node.businessFound ? node.direction : "Not in sample"}</span>
          </div>)}
        </div>
        {scan.aiGeoActionPlan?.diagnosis && <div className="mx-4 mb-4 rounded-lg border bg-brand-50 p-3"><p className="text-[11px] font-semibold text-brand-700">Suggested next steps</p><p className="mt-1 text-[11px] leading-5 text-brand-600">{scan.aiGeoActionPlan.diagnosis}</p></div>}
      </Panel>}

      <Panel title="Previous map scans" subtitle="Each row is a saved snapshot; positions can change between scans.">
        <QueryState isLoading={history.isLoading} error={history.error} isEmpty={!history.data?.length} emptyTitle="No map scans yet" emptyBody="Run a scan above to save the first location-based snapshot.">
          <div className="divide-y">
            {history.data?.map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span><span className="block text-[12px] font-semibold text-brand-900">{run.keyword}</span><span className="text-[10px] text-brand-400">{new Date(run.ranAt).toLocaleString()} · {run.gridSize} × {run.gridSize} · {run.source}</span></span>
              <span className="text-right text-[11px] text-brand-600">{run.averageRank == null ? "Not found in sample" : `Average #${run.averageRank.toFixed(1)}`} · {run.foundCount}/{run.pointCount} points</span>
            </div>)}
          </div>
        </QueryState>
      </Panel>

      <StatusNote tone="info">
        Owner-only Google Business Profile fields, performance metrics, review management and publishing require approved Business Profile API access and server-side data endpoints. This page currently shows public Places snapshots only; it does not claim to sync or edit the owner profile.
      </StatusNote>
    </div>
  );
}
