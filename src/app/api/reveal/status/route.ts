// 輪詢端點：對方掃了我之後，我這邊要自己翻開，不必叫使用者重整。
// 比賽期間還兼任「比賽狀態」的來源——鳴槍、收場、自己完賽了沒，都靠它傳回來。
//
// 只回「每一對揭曉了沒」、比賽階段與**自己這一隊**的名次，**不回任何人的姓名 email**
// ——那些要走 POST /api/reveal 驗證過才給，或由 page 在 server 端組好。
// 這裡被多打幾次也洩不出東西。
import { NextResponse } from "next/server";
import { getSession } from "@/lib/tpass-auth";
import { lookupByEmail, loadPairs, pairKeyOf } from "@/lib/pairs";
import { eventState } from "@/lib/event";
import { boardOf, finishedPairKeys, teamKeyOf } from "@/lib/standings";
import { revealFlagsFor } from "@/lib/reveal-policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const state = await eventState();
  // 欄位只增不減：舊版 client 只讀 revealed，照樣運作。
  const base = {
    phase: state.phase,
    round: state.round,
    startedAt: state.startedAt,
    serverNow: new Date().toISOString(),
  };

  const lookup = await lookupByEmail(session.email);
  if (!lookup) return NextResponse.json({ ...base, revealed: [], finish: null });

  const revealed = await revealFlagsFor(lookup);

  // 自己這一隊的成績（計分看隊）與還沒相認的配對數（相認看對）。
  // 只挑自己的那一隊，別人的名次不從這裡外流。
  const { pairs } = await loadPairs();
  const board = boardOf(state, pairs);
  const myTeam = teamKeyOf(lookup.pairs);
  const hit = board.standings.find((s) => s.seniorKey === myTeam);
  const scanned = finishedPairKeys(state);

  return NextResponse.json({
    ...base,
    revealed,
    finish: hit ? { rank: hit.rank, ms: hit.ms } : null,
    pending: lookup.pairs.filter((p) => !scanned.has(pairKeyOf(p))).length,
    total: board.total,
  });
}
