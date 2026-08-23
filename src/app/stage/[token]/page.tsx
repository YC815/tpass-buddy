// 大螢幕：投影用的排行榜與頒獎動畫。
//
// 保護方式與 /roster/<token> 完全相同：免登入，靠不可猜的路徑（BUDDY_ROSTER_TOKEN）。
// 投影電腦不必跑一次 Google 登入流程，也不怕 session 在活動中途過期斷在台上。
// token 用單純 !== 比對，理由同總表頁。
//
// 這頁刻意沒有 Header / Footer：布幕上每一格像素都要留給比賽。
import { notFound } from "next/navigation";
import { authConfig } from "@/config/auth";
import { loadPairs } from "@/lib/pairs";
import { eventState } from "@/lib/event";
import { boardOf, publicStandings, publicTeams } from "@/lib/standings";
import { StageBoard } from "@/components/stage/StageBoard";
import type { StageData } from "@/components/stage/types";

// 資料是 runtime 讀檔的，別讓 Next 把這頁靜態化。
export const dynamic = "force-dynamic";

export default async function StagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (token !== authConfig.rosterToken) notFound();

  // 先給一份，之後由 client 每秒自己去問 /api/stage/<token>/board。
  // 這樣布幕在載入的第一幀就有正確畫面，不會閃一下空白。
  const [state, { pairs }] = await Promise.all([eventState(), loadPairs()]);
  const board = boardOf(state, pairs);

  const initial: StageData = {
    phase: state.phase,
    round: state.round,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    serverNow: new Date().toISOString(),
    total: board.total,
    // 個資邊界：剝掉 pairKey（含信箱）與登記方式，同 board route。
    standings: publicStandings(board.standings),
    unfinished: publicTeams(board.unfinished),
  };

  return <StageBoard token={token} initial={initial} />;
}
