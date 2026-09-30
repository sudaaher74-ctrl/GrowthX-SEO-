"use client";
import { useState } from "react";
import { Panel, Table, Tabs, Td, Th, Tr } from "@/components/ui/console";
import type { Ga4ReportData } from "@/lib/api-client";
import { DASH, count, percent } from "@/lib/google-format";

type Tab = "channels" | "sources" | "countries" | "cities";

const REFRESH = "This was stored before it was fetched. Press Refresh data above to load it.";

function Bar({ share, highlight }: { share: number; highlight?: boolean }) {
  return (
    <div className="h-1.5 w-24 rounded-full bg-brand-100">
      <div className={highlight ? "h-1.5 rounded-full bg-primary-600" : "h-1.5 rounded-full bg-brand-400"} style={{ width: `${Math.max(share * 100, share > 0 ? 1.5 : 0)}%` }} />
    </div>
  );
}

/**
 * Where visits come from, at four levels: the channel, the named source
 * (a site, app or campaign), the country and the city. All from the stored
 * Google Analytics report; a level the report was stored without says so
 * instead of showing an empty table.
 */
export function TrafficOrigins({ data }: { data: Ga4ReportData }) {
  const [tab, setTab] = useState<Tab>("channels");
  const total = data.channels.reduce((s, c) => s + c.sessions, 0) || data.totals.sessions;
  const share = (n: number) => (total > 0 ? n / total : 0);

  const channels = [...data.channels].sort((a, b) => b.sessions - a.sessions);
  const sources = data.sources ? [...data.sources].sort((a, b) => b.sessions - a.sessions) : null;
  const countries = [...data.countries].sort((a, b) => b.sessions - a.sessions);
  const cities = data.cities ? [...data.cities].sort((a, b) => b.sessions - a.sessions) : null;

  return (
    <Panel
      title="Where your traffic comes from"
      subtitle="Sessions in the last period, by channel, named source, country and city. Google Analytics 4."
      padded
    >
      <div className="mb-3">
        <Tabs
          tabs={[
            { id: "channels", label: "Channels" },
            { id: "sources", label: "Sources" },
            { id: "countries", label: "Countries" },
            { id: "cities", label: "Cities" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "channels" && (
        <Table minWidth={560}>
          <thead>
            <tr>
              <Th>Channel</Th>
              <Th align="right">Sessions</Th>
              <Th align="right">Share</Th>
              <Th align="right">Engagement</Th>
              <Th align="right">Key events</Th>
              <Th>Volume</Th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <Tr key={c.channel}>
                <Td><span className="text-[12.5px] font-semibold text-brand-950">{c.channel}</span></Td>
                <Td align="right">{count(c.sessions)}</Td>
                <Td align="right">{percent(share(c.sessions))}</Td>
                <Td align="right">{c.engagementRate === undefined ? DASH : percent(c.engagementRate)}</Td>
                <Td align="right">{c.keyEvents == null ? DASH : count(c.keyEvents)}</Td>
                <Td><Bar share={share(c.sessions)} highlight={c.organic} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {tab === "sources" &&
        (sources === null ? (
          <p className="py-4 text-[12px] text-brand-500">{REFRESH}</p>
        ) : sources.length === 0 ? (
          <p className="py-4 text-[12px] text-brand-500">Google Analytics returned no sources for this period.</p>
        ) : (
          <Table minWidth={640}>
            <thead>
              <tr>
                <Th>Source / medium</Th>
                <Th>Channel</Th>
                <Th align="right">Sessions</Th>
                <Th align="right">Share</Th>
                <Th align="right">Engagement</Th>
                <Th>Volume</Th>
              </tr>
            </thead>
            <tbody>
              {sources.map((x) => (
                <Tr key={`${x.source}/${x.medium}/${x.channel}`}>
                  <Td><span className="block max-w-[240px] truncate text-[12px] text-brand-950" title={`${x.source} / ${x.medium}`}>{x.source} / {x.medium}</span></Td>
                  <Td><span className="text-[12px] text-brand-600">{x.channel}</span></Td>
                  <Td align="right">{count(x.sessions)}</Td>
                  <Td align="right">{percent(share(x.sessions))}</Td>
                  <Td align="right">{percent(x.engagementRate)}</Td>
                  <Td><Bar share={share(x.sessions)} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ))}

      {tab === "countries" && (
        <Table minWidth={420}>
          <thead>
            <tr>
              <Th>Country</Th>
              <Th align="right">Sessions</Th>
              <Th align="right">Users</Th>
              <Th align="right">Share</Th>
              <Th>Volume</Th>
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <Tr key={c.country}>
                <Td>{c.country}</Td>
                <Td align="right">{count(c.sessions)}</Td>
                <Td align="right">{count(c.users)}</Td>
                <Td align="right">{percent(share(c.sessions))}</Td>
                <Td><Bar share={share(c.sessions)} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {tab === "cities" &&
        (cities === null ? (
          <p className="py-4 text-[12px] text-brand-500">{REFRESH}</p>
        ) : (
          <Table minWidth={480}>
            <thead>
              <tr>
                <Th>City</Th>
                <Th>Country</Th>
                <Th align="right">Sessions</Th>
                <Th align="right">Users</Th>
                <Th align="right">Share</Th>
              </tr>
            </thead>
            <tbody>
              {cities.map((c) => (
                <Tr key={`${c.city}/${c.country}`}>
                  <Td>{c.city}</Td>
                  <Td>{c.country}</Td>
                  <Td align="right">{count(c.sessions)}</Td>
                  <Td align="right">{count(c.users)}</Td>
                  <Td align="right">{percent(share(c.sessions))}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ))}

      <p className="mt-3 text-[11px] text-brand-500">
        “—” means Google Analytics did not measure it. Users are counted per row, so they can add up to more than the distinct total.
      </p>
    </Panel>
  );
}
