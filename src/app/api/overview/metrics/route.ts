import { NextResponse } from "next/server";
import { mockMetrics } from "@/lib/mock-data";

export async function GET() {
  try {
    // In Phase 3, replace this with Prisma database query or NestJS service call:
    // const metrics = await prisma.workspaceMetrics.findUnique({ where: { id: ... } });
    return NextResponse.json(mockMetrics, { status: 200 });
  } catch (error) {
    console.error("[API Error] Failed to fetch overview metrics:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
