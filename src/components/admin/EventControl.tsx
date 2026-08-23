"use client";

// 主持人控制台。/admin 頁最上面那一塊。
//
// 這是全站唯一有寫入操作的 UI。四件事：
//   1. 直屬公布開關（平日就開著）
//   2. 鳴槍 / 收場 / 回到待命
//   3. 即時排行榜
//   4. 未完賽名單 + 手動補登（有人手機沒電或會場沒網路）
//
// 比賽進行中每 3 秒自己 router.refresh() 一次拉新排名——主持人這一台是唯一的，
// 不必為它做推播。大螢幕那邊是另一條路（/stage 自己 1 秒輪詢）。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, RotateCcw, Square, Trophy, TriangleAlert } from "lucide-react";
import type { AdminBoard } from "@/lib/standings";
import { formatMs } from "@/lib/format";
import { useServerClock } from "@/components/useServerClock";
import { Badge, Button, Card, Switch } from "@/components/ui/primitives";

const POLL_MS = 3_000;

export interface EventControlProps {
  publicReveal: boolean;
  phase: "idle" | "racing" | "ended";
  round: number;
  startedAt: string | null;
  board: AdminBoard;
  // 伺服器現在幾點。用來校正主持人這台電腦的時鐘偏移，
  // 免得計時器跟真正的成績差好幾秒。
  serverNow: string;
}

type Action = "publish" | "unpublish" | "start" | "stop" | "reset" | "mark";

export function EventControl({
  publicReveal,
  phase,
  round,
  startedAt,
  board,
  serverNow,
}: EventControlProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: Action, pairKey?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, pairKey }),
      });
      if (!res.ok) {
        setError(`操作失敗（${res.status}）。重整一次再試。`);
        return;
      }
      router.refresh();
    } catch {
      setError("送不出去，檢查一下網路。");
    } finally {
      setBusy(false);
    }
  }

  // 比賽中自動拉新排名。
  useEffect(() => {
    if (phase !== "racing") return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [phase, router]);

  const finished = board.standings.length;

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-foreground pb-4">
        <div className="flex items-center gap-3">
          <PhaseBadge phase={phase} round={round} />
          {phase === "racing" ? (
            <LiveClock startedAt={startedAt} serverNow={serverNow} />
          ) : null}
        </div>

        <label className="flex items-center gap-2.5">
          <span className="text-sm font-bold">直屬公布</span>
          <Switch
            checked={publicReveal}
            onChange={(next) => send(next ? "publish" : "unpublish")}
            label="直屬公布"
          />
          <span className="font-mono text-[11px] font-bold text-muted-foreground">
            {publicReveal ? "進站直接看到" : "要現場相認"}
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          disabled={busy || phase === "racing"}
          onClick={() => {
            if (
              !confirm(
                "要鳴槍開始嗎？\n\n所有人的六位碼與 QR 會立刻重新產生，賽前截的圖一律失效。",
              )
            )
              return;
            send("start");
          }}
        >
          <Flag className="h-4 w-4" />
          {round === 0 ? "鳴槍開始" : "鳴槍開始（第 " + (round + 1) + " 場）"}
        </Button>

        <Button
          variant="destructive"
          disabled={busy || phase !== "racing"}
          onClick={() => send("stop")}
        >
          <Square className="h-4 w-4" />
          收場
        </Button>

        <Button
          disabled={busy || phase === "idle"}
          onClick={() => send("reset")}
        >
          <RotateCcw className="h-4 w-4" />
          回到待命
        </Button>

        {phase !== "idle" ? (
          <span className="font-mono text-sm font-bold text-muted-foreground">
            已完成 {finished} / {board.total}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="flex items-center gap-2 rounded-xl border-2 border-destructive bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {phase !== "idle" ? (
        <>
          <Leaderboard board={board} />
          <Unfinished
            board={board}
            canMark={phase === "racing" && !busy}
            onMark={(pairKey) => send("mark", pairKey)}
          />
        </>
      ) : (
        <p className="text-sm font-medium text-muted-foreground">
          待命中。按「鳴槍開始」進入比賽，大螢幕在 <code className="font-mono">/stage/&lt;總表 token&gt;</code>。
        </p>
      )}
    </Card>
  );
}

function PhaseBadge({ phase, round }: { phase: string; round: number }) {
  const look =
    phase === "racing"
      ? { text: `比賽中 · 第 ${round} 場`, tone: "bg-tone-green-badge" }
      : phase === "ended"
        ? { text: `已收場 · 第 ${round} 場`, tone: "bg-tone-orange-badge" }
        : { text: "待命中", tone: "bg-muted text-muted-foreground" };
  return <Badge className={look.tone}>{look.text}</Badge>;
}

// 大計時器。從鳴槍時間往上跑，用伺服器的錶（見 useServerClock）。
function LiveClock({
  startedAt,
  serverNow,
}: {
  startedAt: string | null;
  serverNow: string;
}) {
  const now = useServerClock(serverNow);

  if (!startedAt || now === null) return null;
  return (
    <span className="font-mono text-2xl font-extrabold tabular-nums">
      {formatMs(now - Date.parse(startedAt))}
    </span>
  );
}

function Leaderboard({ board }: { board: AdminBoard }) {
  if (board.standings.length === 0) {
    return (
      <p className="text-sm font-medium text-muted-foreground">
        還沒有隊伍完賽。
      </p>
    );
  }

  const last = board.standings.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-foreground text-left font-mono text-[11px] tracking-widest text-muted-foreground">
            <th className="px-3 py-2 font-bold">名次</th>
            <th className="px-3 py-2 font-bold">隊伍</th>
            <th className="px-3 py-2 text-right font-bold">成績</th>
            <th className="px-3 py-2 font-bold">登記方式</th>
          </tr>
        </thead>
        <tbody>
          {board.standings.map((s) => (
            <tr
              key={s.seniorKey}
              className="border-b-2 border-foreground/10 last:border-b-0"
            >
              <td className="px-3 py-2">
                <span className="font-mono font-extrabold">{s.rank}</span>
                {s.rank <= 3 ? (
                  <Trophy className="ml-1 inline h-3.5 w-3.5 align-[-2px]" />
                ) : null}
                {s.rank === last && last > 3 ? (
                  <span className="ml-1 font-mono text-[11px] font-bold text-destructive">
                    倒數
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 font-bold">
                <span className="mr-1.5">{s.badge.emoji}</span>
                {s.seniorName} × {s.juniorNames.join("、")}
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                {formatMs(s.ms)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {s.by === "admin" ? "手動補登" : "掃碼"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Unfinished({
  board,
  canMark,
  onMark,
}: {
  board: AdminBoard;
  canMark: boolean;
  onMark: (pairKey: string) => void;
}) {
  if (board.unfinished.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-t-2 border-dashed border-foreground/30 pt-4">
      <span className="font-mono text-[11px] font-bold tracking-widest text-muted-foreground">
        未完賽 {board.unfinished.length} 隊
      </span>
      <ul className="flex flex-col gap-1.5">
        {board.unfinished.map((team) => (
          <li
            key={team.seniorKey}
            className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold"
          >
            <span>{team.seniorName}</span>
            {/* 帶 2 位學弟妹的學長姐會有兩顆按鈕——按實際相認的那一位。
                找到任何一位就算完賽（一隊只取最早的那一位），所以按哪一顆
                對名次的結果相同，但紀錄要留對的人。 */}
            <span className="flex flex-wrap items-center gap-2">
              {team.members.map((m) => (
                <span key={m.pairKey} className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">
                    {m.badge.emoji} {m.juniorName}
                  </span>
                  {canMark ? (
                    <Button
                      size="sm"
                      onClick={() => onMark(m.pairKey)}
                      title="現場目擊兩人相認，以按下的時間計分"
                    >
                      登記完賽
                    </Button>
                  ) : null}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
