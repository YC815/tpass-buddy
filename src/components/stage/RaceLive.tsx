"use client";

// 比賽進行中的大螢幕。
//
// 版面的重點順序：計時器 → 完成數 → 前三名（蓋住）→ 第四名以後。
// 前三名蓋成問號而不是直接顯示，是為了留住懸念——名次一路跑馬燈跑完，
// 最後的頒獎就沒東西可揭曉了。但它只是個「已經有人了」的提示，
// 所以壓成**一列三等份**，不佔版面；真正的領獎台留給頒獎那一頁（Podium）。
//
// 字級一律 clamp() + vw：投影機的解析度與布幕距離都不確定，
// 寫死 px 在 1920 好看、在 1280 就爆版。
import { useServerClock } from "@/components/useServerClock";
import { formatMs } from "@/lib/format";
import type { StageData, StageStanding } from "@/components/stage/types";

// 第四名以後只顯示最近完賽的這麼多隊。全部列出來會排到布幕外面，
// 而且觀眾真正在找的是「剛剛那隊是誰」。
const RECENT = 8;

const MEDAL_TONE = {
  1: "bg-medal-gold",
  2: "bg-medal-silver",
  3: "bg-medal-bronze",
} as const;

export function RaceLive({ data }: { data: StageData }) {
  const now = useServerClock(data.serverNow);
  const elapsed =
    now !== null && data.startedAt
      ? Math.max(0, now - Date.parse(data.startedAt))
      : null;

  // 新完賽的排最前面——觀眾的視線在畫面上半部，不該讓他們往下找。
  const rest = data.standings.slice(3).reverse().slice(0, RECENT);

  return (
    <div className="flex min-h-screen flex-col items-center gap-[3vh] px-[4vw] py-[4vh]">
      <span className="font-mono text-[clamp(0.75rem,1.6vw,1.5rem)] font-bold uppercase tracking-[0.3em] text-muted-foreground">
        T-Buddy 直屬配對競速
      </span>

      <span className="font-mono text-[clamp(4rem,15vw,13rem)] font-extrabold leading-none tabular-nums">
        {elapsed === null ? "—:——" : formatMs(elapsed)}
      </span>

      <span className="text-[clamp(1.25rem,3.5vw,3rem)] font-extrabold tracking-tight">
        已完成{" "}
        <span className="font-mono tabular-nums text-tone-green-text">
          {data.standings.length}
        </span>{" "}
        / {data.total} 隊
      </span>

      {/* 前三名：一列三等份，各一顆問號。只是「這三個位子已經有人了」的提示。 */}
      <div className="grid w-full max-w-[70vw] grid-cols-3 gap-[1.5vw]">
        {([1, 2, 3] as const).map((place) => (
          <MysterySlot
            key={place}
            place={place}
            filled={data.standings.length >= place}
          />
        ))}
      </div>

      {rest.length > 0 ? (
        <ul className="flex w-full max-w-[70vw] flex-col gap-[1vh]">
          {rest.map((s) => (
            <Row key={s.rank} standing={s} />
          ))}
        </ul>
      ) : (
        <p className="text-[clamp(1rem,2vw,1.75rem)] font-bold text-muted-foreground">
          還沒有隊伍完賽
        </p>
      )}
    </div>
  );
}

function MysterySlot({ place, filled }: { place: 1 | 2 | 3; filled: boolean }) {
  return (
    <div
      className={`flex items-center justify-center gap-[1vw] rounded-2xl border-2 border-foreground ${
        filled ? MEDAL_TONE[place] : "bg-muted"
      } px-[1.5vw] py-[1.2vh] shadow-[4px_4px_0_0_var(--color-foreground)]`}
      aria-label={filled ? `第 ${place} 名，尚未揭曉` : `第 ${place} 名，還沒有人`}
    >
      <span className="font-mono text-[clamp(1rem,2.4vw,2rem)] font-extrabold tabular-nums text-foreground/60">
        {place}
      </span>
      <span className="text-[clamp(1.25rem,3vw,2.5rem)] font-extrabold leading-none">
        {filled ? "?" : "—"}
      </span>
    </div>
  );
}

function Row({ standing }: { standing: StageStanding }) {
  return (
    <li
      className="flex items-center gap-[1.5vw] rounded-2xl border-2 border-foreground bg-card px-[2vw] py-[1.2vh] shadow-[4px_4px_0_0_var(--color-foreground)]"
      style={{ animation: "rise-in 0.4s ease-out both" }}
    >
      <span className="w-[3.5vw] shrink-0 text-center font-mono text-[clamp(1rem,2.4vw,2rem)] font-extrabold tabular-nums text-muted-foreground">
        {standing.rank}
      </span>
      <span className="text-[clamp(1.25rem,3vw,2.5rem)] leading-none" aria-hidden>
        {standing.badge.emoji}
      </span>
      <span className="flex-1 truncate text-[clamp(1rem,2.6vw,2.25rem)] font-extrabold tracking-tight">
        {standing.seniorName} × {standing.juniorNames.join("、")}
      </span>
      <span className="shrink-0 font-mono text-[clamp(1rem,2.4vw,2rem)] font-bold tabular-nums">
        {formatMs(standing.ms)}
      </span>
    </li>
  );
}
