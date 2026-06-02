import { NextResponse } from "next/server";
import { refreshDataSourceSnapshots } from "@/lib/data-health";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await refreshDataSourceSnapshots();
  return NextResponse.json({ ok: true, count: results.length });
}
