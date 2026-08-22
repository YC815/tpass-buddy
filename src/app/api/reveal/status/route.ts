// 輪詢端點：對方掃了我之後，我這邊要自己翻開，不必叫使用者重整。
//
// 只回「每一對揭曉了沒」與徽記，**不回姓名 email**——那些要走 POST /api/reveal
// 驗證過才給，或由 page 在 server 端組好。這裡被多打幾次也洩不出東西。
import { NextResponse } from "next/server";
import { getSession } from "@/lib/tpass-auth";
import { lookupByEmail } from "@/lib/pairs";
import { revealFlagsFor } from "@/lib/reveal-policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const lookup = await lookupByEmail(session.email);
  if (!lookup) return NextResponse.json({ revealed: [] });

  return NextResponse.json({ revealed: await revealFlagsFor(lookup) });
}
