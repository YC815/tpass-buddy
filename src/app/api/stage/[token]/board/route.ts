// 大螢幕的資料來源。/stage 每秒問一次。
//
// 保護方式與 /roster/<token> 同一條：不可猜的路徑（BUDDY_ROSTER_TOKEN），免登入。
// 投影電腦不必跑一次 Google 登入流程，也不怕 session 在活動中途過期斷在台上。
//
// 回什麼：徽記 + 雙方全名 + 秒數。**沒有信箱，也沒有 pairKey**
// （那把 key 含信箱，剝除由 standings.ts 的 publicStandings / publicTeams 在型別層保證）。
// 也不回「這隊是手動補登的」——那是後台才該知道的事，投影出去只會引起爭議。
//
// 為什麼是輪詢不是 SSE：對外入口的 nginx vhost 是 root 管的，要加 proxy_buffering off
// 得請維運者 sudo；Cloudflare 橘雲對 SSE 也不友善。一台大螢幕每秒一次，成本可以忽略。
import { NextResponse } from "next/server";
import { authConfig } from "@/config/auth";
import { loadPairs } from "@/lib/pairs";
import { eventState } from "@/lib/event";
import { boardOf, publicStandings, publicTeams } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (token !== authConfig.rosterToken) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [state, { pairs }] = await Promise.all([eventState(), loadPairs()]);
  const board = boardOf(state, pairs);

  return NextResponse.json({
    phase: state.phase,
    round: state.round,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    // 大螢幕的計時器跟著伺服器的錶走，不信任投影電腦的系統時間。
    serverNow: new Date().toISOString(),
    total: board.total,
    standings: publicStandings(board.standings),
    unfinished: publicTeams(board.unfinished),
  });
}
