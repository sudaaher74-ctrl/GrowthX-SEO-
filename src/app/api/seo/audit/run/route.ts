import { NextRequest, NextResponse } from "next/server";
import { mockTechnicalIssues } from "@/lib/mock-data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json({ error: "Domain parameter is required" }, { status: 400 });
    }

    // In Phase 3, this triggers a BullMQ worker on the NestJS cluster:
    // await auditQueue.add("run-audit", { domain, timestamp: Date.now() });

    return NextResponse.json({
      status: "success",
      domain,
      issuesFound: mockTechnicalIssues.total,
      breakdown: mockTechnicalIssues.byCategory,
      durationMs: 1420,
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (error) {
    console.error("[API Error] Failed to run SEO audit:", error);
    return NextResponse.json({ error: "Internal server error during crawl" }, { status: 500 });
  }
}
