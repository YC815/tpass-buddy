"use client";

// 秒數滾動。揭曉一個名次時，成績從 0 跑到真正的數字。
//
// 為什麼不是直接顯示：主持人念出名次之後，觀眾的視線會落在秒數上——
// 讓它跑一下，那個數字才會被看見。
//
// active 為 false 就直接顯示終值（還沒輪到這個名次、或倒退回上一步）。
// 進度只存 0→1 的比例，終值在 render 端算——這樣 effect 裡不必同步 setState
// （React Compiler 會擋，那確實會造成連鎖 render）。
import { useEffect, useState } from "react";
import { formatMs } from "@/lib/format";

const DURATION_MS = 1100;

// ease-out：一開始衝很快，最後幾格慢慢停。線性的話看起來像跑馬燈壞掉。
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({
  ms,
  active,
  className,
}: {
  ms: number;
  active: boolean;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) return;

    let raf = 0;
    // 使用者說了不要動畫就直接跳終值（仍然走 rAF，避免同步 setState）。
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setProgress(1));
      return () => cancelAnimationFrame(raf);
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      setProgress(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms, active]);

  return (
    <span className={className}>
      {formatMs(active ? ms * easeOut(progress) : ms)}
    </span>
  );
}
