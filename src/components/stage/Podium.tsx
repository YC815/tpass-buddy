"use client";

// 頒獎。主持人按一次鍵播一段，五個步驟：
//
//   0  三個問號 + 完賽隊數（等主持人開口）
//   1  第三名（銅）
//   2  第二名（銀）
//   3  第一名（金）— 卡片放大、邊框脈動、全螢幕彩帶
//   4  倒數第一名 — 整頁翻紅、卡片抖動、接受處罰
//
// 為什麼由小到大：第一名先出來，後面兩個就沒人在乎了。
//
// 資料在進入步驟 1 的那一刻由 StageBoard 凍結——頒獎途中主持人若在後台補登了誰，
// 名次不該在台上跳動。
import { useEffect, useRef } from "react";
import { fireConfetti } from "@/lib/confetti";
import { CountUp } from "@/components/stage/CountUp";
import type { StageData, StageStanding } from "@/components/stage/types";

// 揭曉到第幾步時，哪個名次會亮。
const REVEAL_AT: Record<1 | 2 | 3, number> = { 3: 1, 2: 2, 1: 3 };

export function Podium({ data, step }: { data: StageData; step: number }) {
  const slots = useRef<Record<number, HTMLDivElement | null>>({});

  // 剛揭曉的那一張噴彩帶。金牌噴大的。
  useEffect(() => {
    const place = step === 1 ? 3 : step === 2 ? 2 : step === 3 ? 1 : null;
    if (place === null) return;
    const el = slots.current[place];
    if (!el) return;

    fireConfetti(
      el,
      place === 1
        ? { count: 260, lifeMs: 2600, scale: 2.2 }
        : { count: 110, lifeMs: 1800, scale: 1.6 },
    );
  }, [step]);

  if (step >= 4) return <Punishment data={data} />;

  const byPlace = (place: 1 | 2 | 3): StageStanding | undefined =>
    data.standings[place - 1];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-[4vh] px-[4vw] py-[4vh]">
      <div className="flex flex-col items-center gap-[1vh]">
        <span className="font-mono text-[clamp(0.75rem,1.6vw,1.5rem)] font-bold uppercase tracking-[0.3em] text-muted-foreground">
          最終成績
        </span>
        <span className="text-[clamp(1.5rem,4vw,3.5rem)] font-extrabold tracking-tight">
          完賽{" "}
          <span className="font-mono tabular-nums text-tone-green-text">
            {data.standings.length}
          </span>{" "}
          / {data.total} 隊
        </span>
      </div>

      {/* 銀在左、金在中、銅在右——實體領獎台就是這個排法。 */}
      <div className="flex w-full max-w-[80vw] items-end justify-center gap-[2vw]">
        {([2, 1, 3] as const).map((place) => (
          <Slot
            key={place}
            ref={(el) => {
              slots.current[place] = el;
            }}
            place={place}
            standing={byPlace(place)}
            step={step}
          />
        ))}
      </div>

      {step === 0 ? (
        <p className="font-mono text-[clamp(0.75rem,1.4vw,1.25rem)] font-bold tracking-widest text-muted-foreground">
          按空白鍵揭曉第三名
        </p>
      ) : null}
    </div>
  );
}

function Slot({
  ref,
  place,
  standing,
  step,
}: {
  ref: (el: HTMLDivElement | null) => void;
  place: 1 | 2 | 3;
  standing: StageStanding | undefined;
  step: number;
}) {
  const look = {
    1: { h: "22vh", tone: "bg-medal-gold", card: "max-w-[24vw]" },
    2: { h: "15vh", tone: "bg-medal-silver", card: "max-w-[20vw]" },
    3: { h: "10vh", tone: "bg-medal-bronze", card: "max-w-[20vw]" },
  }[place];

  const revealAt = REVEAL_AT[place];
  const shown = step >= revealAt;
  // 「就是這一步剛翻開的」——只有它要播進場動畫與數字滾動。
  const fresh = step === revealAt;

  return (
    <div className="flex flex-1 flex-col items-center">
      <div
        ref={ref}
        className={`mb-[1.5vh] w-full ${look.card} [perspective:1200px]`}
      >
        {shown && standing ? (
          <div
            // key 綁在步驟上：倒退再前進時整個重新掛載，動畫與數字才會重播。
            key={`${place}-${step}`}
            className={`flex flex-col items-center gap-[1vh] rounded-2xl border-2 border-foreground ${look.tone} px-[1.5vw] py-[2vh] text-center shadow-[10px_10px_0_0_var(--color-foreground)] ${
              fresh ? "anim-flip-in" : ""
            } ${place === 1 && step === 3 ? "anim-glow scale-105" : ""}`}
          >
            <span
              className="text-[clamp(2rem,6vw,5rem)] leading-none"
              role="img"
              aria-label={standing.badge.name}
            >
              {standing.badge.emoji}
            </span>
            <span className="text-[clamp(1rem,2.4vw,2.25rem)] font-extrabold leading-tight tracking-tight">
              {standing.seniorName}
              <br />×<br />
              {standing.juniorNames.join("、")}
            </span>
            <CountUp
              ms={standing.ms}
              active={fresh}
              className="font-mono text-[clamp(1rem,2.2vw,2rem)] font-bold tabular-nums"
            />
          </div>
        ) : (
          <div
            className={`flex aspect-square w-full items-center justify-center rounded-2xl border-2 border-foreground ${
              standing ? look.tone : "bg-muted"
            } text-[clamp(2rem,7vw,6rem)] font-extrabold shadow-[6px_6px_0_0_var(--color-foreground)]`}
          >
            {standing ? "?" : "—"}
          </div>
        )}
      </div>

      <div
        className={`w-full rounded-t-xl border-2 border-b-0 border-foreground ${look.tone} flex items-start justify-center pt-[1vh]`}
        style={{ height: look.h }}
      >
        <span className="font-mono text-[clamp(1.5rem,4vw,3.5rem)] font-extrabold">
          {place}
        </span>
      </div>
    </div>
  );
}

// 倒數第一名 = 最後一個完賽的隊伍。未完賽的不算——他們多半根本沒到場，罰不到。
function Punishment({ data }: { data: StageData }) {
  const last = data.standings[data.standings.length - 1];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-[4vh] bg-destructive px-[4vw] py-[4vh] text-center">
      <span className="font-mono text-[clamp(1rem,2.4vw,2rem)] font-bold uppercase tracking-[0.3em] text-primary-foreground">
        倒數第一名
      </span>

      {last ? (
        <div className="anim-shake flex flex-col items-center gap-[2vh] rounded-2xl border-2 border-foreground bg-card px-[4vw] py-[4vh] shadow-[10px_10px_0_0_var(--color-foreground)]">
          <span
            className="text-[clamp(3rem,10vw,8rem)] leading-none"
            role="img"
            aria-label={last.badge.name}
          >
            {last.badge.emoji}
          </span>
          <span className="text-[clamp(1.5rem,5vw,4rem)] font-extrabold tracking-tight">
            {last.seniorName} × {last.juniorNames.join("、")}
          </span>
          <span className="font-mono text-[clamp(1.25rem,3vw,2.5rem)] font-bold tabular-nums text-muted-foreground">
            第 {last.rank} 名 · <CountUp ms={last.ms} active={false} />
          </span>
        </div>
      ) : (
        <p className="text-[clamp(1.5rem,4vw,3rem)] font-extrabold text-primary-foreground">
          沒有隊伍完賽
        </p>
      )}

      <span className="text-[clamp(1.5rem,5vw,4rem)] font-extrabold tracking-tight text-primary-foreground">
        ⚡ 接受處罰 ⚡
      </span>
    </div>
  );
}
