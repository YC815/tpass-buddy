"use client";

// 大螢幕主控。投影電腦開這一頁就不用再碰了。
//
// 資料靠每秒輪詢 /api/stage/<token>/board（為什麼不是 SSE，見那支 route 的註解）。
// 頒獎的節奏由主持人控制：空白鍵 / → / 點畫面推進，← 倒退，Esc 回到開頭，F 全螢幕。
//
// ★ 凍結 ★
// 一進入頒獎（步驟 1）就把當下的資料鎖住。台上正在念第三名的時候，
// 後台若有人被手動補登，名次不該在布幕上跳動。
import { useCallback, useEffect, useRef, useState } from "react";
import { RaceLive } from "@/components/stage/RaceLive";
import { Podium } from "@/components/stage/Podium";
import type { StageData } from "@/components/stage/types";

const POLL_MS = 1000;
const LAST_STEP = 4;

export function StageBoard({
  token,
  initial,
}: {
  token: string;
  initial: StageData;
}) {
  const [data, setData] = useState(initial);
  const [step, setStep] = useState(0);
  const [frozen, setFrozen] = useState<StageData | null>(null);

  // 上一次看到的階段。變了就把頒獎流程歸零——主持人重開一場時
  // 布幕不該還停在上一場的金牌畫面。
  const lastPhase = useRef(`${initial.phase}|${initial.round}`);

  useEffect(() => {
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/stage/${token}/board`, {
          cache: "no-store",
        });
        if (!res.ok || stopped) return;
        const next = (await res.json()) as StageData;
        if (stopped) return;

        setData(next);

        const key = `${next.phase}|${next.round}`;
        if (key !== lastPhase.current) {
          lastPhase.current = key;
          setStep(0);
          setFrozen(null);
        }
      } catch {
        // 網路瞬斷不必在布幕上顯示錯誤，下一秒再問。
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [token]);

  const advance = useCallback(() => {
    setStep((s) => {
      if (s >= LAST_STEP) return s;
      // 0 → 1 的那一刻凍結資料，之後整場頒獎都用這一份。
      if (s === 0) setFrozen(data);
      return s + 1;
    });
  }, [data]);

  const back = useCallback(() => {
    setStep((s) => {
      const next = Math.max(0, s - 1);
      if (next === 0) setFrozen(null);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setStep(0);
    setFrozen(null);
  }, []);

  // 頒獎只在收場之後才有意義；比賽進行中按鍵不該有反應。
  const canAdvance = data.phase === "ended";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "f" || event.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
        return;
      }
      if (!canAdvance) return;

      if (event.key === " " || event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault(); // 空白鍵預設會捲動頁面
        advance();
      } else if (event.key === "ArrowLeft") {
        back();
      } else if (event.key === "Escape") {
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canAdvance, advance, back, reset]);

  const view = frozen ?? data;

  return (
    <div
      className="min-h-screen bg-background"
      onClick={canAdvance ? advance : undefined}
    >
      {view.phase === "idle" ? (
        <Standby total={view.total} />
      ) : view.phase === "racing" ? (
        <RaceLive data={view} />
      ) : (
        <Podium data={view} step={step} />
      )}

      <Hint canAdvance={canAdvance} step={step} />
    </div>
  );
}

function Standby({ total }: { total: number }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-[3vh] px-[4vw] text-center">
      <span className="font-mono text-[clamp(0.75rem,1.6vw,1.5rem)] font-bold uppercase tracking-[0.3em] text-muted-foreground">
        T-Buddy 直屬配對競速
      </span>
      <span className="text-[clamp(2.5rem,9vw,8rem)] font-extrabold leading-none tracking-tight">
        準備開始
      </span>
      <span className="text-[clamp(1rem,2.6vw,2.25rem)] font-bold text-muted-foreground">
        全場 {total} 隊 · 等主持人鳴槍
      </span>
    </div>
  );
}

// 主持人的小抄。刻意做得很淡——它在布幕上，但不該搶戲。
function Hint({ canAdvance, step }: { canAdvance: boolean; step: number }) {
  if (!canAdvance) return null;
  return (
    <p className="pointer-events-none fixed bottom-[2vh] left-1/2 -translate-x-1/2 font-mono text-[clamp(0.6rem,1.1vw,0.9rem)] font-bold tracking-widest text-muted-foreground/60">
      {step >= LAST_STEP
        ? "← 倒退 · Esc 回到開頭 · F 全螢幕"
        : "空白鍵 / 點畫面推進 · ← 倒退 · F 全螢幕"}
    </p>
  );
}
