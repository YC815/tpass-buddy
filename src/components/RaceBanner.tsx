"use client";

// 比賽期間插在個人頁最上面的那一塊：大計時器，或是自己的成績。
//
// 只顯示「自己這一隊」的名次——別人的成績要看大螢幕。這頁跟平常一樣，
// 永遠不會把第三人的資料放進 RSC payload。
//
// ★ 計分看隊、相認看對 ★
// 一隊 = 一位學長姐（帶 2 位學弟妹的也只有一隊，成績取最早找到的那一位），
// 所以名次只有一個；但每一對都還是要掃到，所以 pending 可能仍大於 0。
// 那個狀態要講清楚，不然學長姐會以為自己不用再找第二位了。
import { Flag, Timer, Trophy, UserSearch } from "lucide-react";
import { formatMs } from "@/lib/format";
import { useServerClock } from "@/components/useServerClock";
import { Card } from "@/components/ui/primitives";

export function RaceBanner({
  phase,
  startedAt,
  serverNow,
  finish,
  pending,
  total,
}: {
  phase: "racing" | "ended";
  startedAt: string | null;
  serverNow: string;
  // 隊伍的名次。完賽了就有，還沒完賽是 null。
  finish: { rank: number; ms: number } | null;
  // 我名下還有幾對沒相認。
  pending: number;
  total: number;
}) {
  const now = useServerClock(serverNow);
  const running = phase === "racing" && finish === null;

  // 時鐘還沒校正好（第一幀）就先留白，不要閃一個 0:00.0 出來。
  const elapsed =
    now !== null && startedAt ? Math.max(0, now - Date.parse(startedAt)) : null;

  return (
    <Card
      className={`flex w-full flex-col items-center gap-3 self-center text-center ${
        running ? "bg-tone-green-bg" : "bg-tone-orange-bg"
      }`}
    >
      {running ? (
        <>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Timer className="size-3.5" aria-hidden />
            比賽進行中
          </span>
          <span className="font-mono text-5xl font-extrabold tabular-nums">
            {elapsed === null ? "—:——" : formatMs(elapsed)}
          </span>
          <p className="text-sm font-bold">
            找到你的直屬，其中一個人掃另一個的 QR 就算完成
          </p>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {phase === "ended" ? (
              <Flag className="size-3.5" aria-hidden />
            ) : (
              <Trophy className="size-3.5" aria-hidden />
            )}
            {phase === "ended"
              ? "比賽結束"
              : pending > 0
                ? "你的隊伍已完賽"
                : "你完成了"}
          </span>

          {finish ? (
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-4xl font-extrabold tabular-nums">
                第 {finish.rank} 名
              </span>
              <span className="font-mono text-2xl font-bold tabular-nums text-muted-foreground">
                {formatMs(finish.ms)}
              </span>
            </div>
          ) : (
            <span className="font-mono text-2xl font-bold text-muted-foreground">
              未完賽
            </span>
          )}

          {/* 成績定了但還有人沒相認：只有帶 2 位學弟妹的學長姐與他的第二位
              學弟妹會走到這裡。不講清楚的話他們會以為不用再找了。 */}
          {phase === "racing" && pending > 0 ? (
            <p className="inline-flex items-center gap-1.5 rounded-xl border-2 border-foreground bg-card px-3 py-1.5 text-sm font-bold">
              <UserSearch className="size-4 shrink-0" aria-hidden />
              還有 {pending} 位直屬沒相認 —— 不再計分，但還是去找他吧
            </p>
          ) : null}

          <p className="text-xs font-medium text-muted-foreground">
            全場 {total} 隊。完整排名看大螢幕。
          </p>
        </>
      )}
    </Card>
  );
}
