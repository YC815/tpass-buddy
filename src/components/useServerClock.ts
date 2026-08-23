"use client";

// 「現在幾點」——但用伺服器的錶。
//
// 計時器如果直接讀 Date.now()，看到的是使用者那台裝置的時鐘。手機沒對時、
// 投影電腦慢了 40 秒，畫面上的秒數就跟實際成績對不起來（成績是伺服器算的）。
// 所以掛載時量一次偏移，之後都用「本機時間 − 偏移」。
//
// 回 null 代表還沒掛載完。這同時解掉 SSR hydration 不一致：
// server 端 render 不會有時間，client 第一幀才補上。
//
// 為什麼偏移只量一次：一場比賽幾分鐘，時鐘不會在中途漂走；
// 每次 tick 重量反而會把網路延遲的抖動灌進計時器。
import { useEffect, useState } from "react";

export function useServerClock(serverNow: string, intervalMs = 200): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const skew = Date.now() - Date.parse(serverNow);
    const tick = () => setNow(Date.now() - skew);
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [serverNow, intervalMs]);

  return now;
}
