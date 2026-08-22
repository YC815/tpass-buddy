"use client";

// 一張卡 = 一組配對。未相認時是背面（徽記），相認後翻成正面（對方是誰）。
//
// 為什麼要翻牌而不是直接顯示：這張卡在活動當天是「還沒揭曉」的狀態，
// 直接把名字 fade 進來就只是查表；翻面是唯一有「揭曉」重量的動作。
import { useEffect, useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import type { BadgeMark } from "@/lib/pairs";

export interface RevealedPerson {
  name: string;
  email: string;
  grade: string;
}

// 底色由徽記 emoji 決定，同一枚徽記永遠同一個顏色。
const TONES = [
  "bg-tone-green-bg",
  "bg-tone-blue-bg",
  "bg-tone-orange-bg",
  "bg-tone-violet-bg",
  "bg-tone-rose-bg",
];

function toneFor(emoji: string): string {
  let h = 5381;
  for (const ch of emoji) h = (h * 33 + ch.codePointAt(0)!) >>> 0;
  return TONES[h % TONES.length];
}

export function BadgeCard({
  badge,
  person,
  animate,
}: {
  badge: BadgeMark;
  person: RevealedPerson | null;
  // 這一次翻開是「剛剛發生的」還是「本來就開著」（重整進來）。
  // 後者不該重播動畫——每次開網頁都等一輪翻牌很快就變擾民。
  animate: boolean;
}) {
  const revealed = person !== null;
  const [contentIn, setContentIn] = useState(revealed && !animate);
  const [copied, setCopied] = useState(false);
  const tone = toneFor(badge.emoji);

  // 翻轉結束才讓正面內容依序進場，不然內容會在卡片還側著時就開始跑。
  useEffect(() => {
    if (!revealed || !animate) return;
    const timer = setTimeout(() => setContentIn(true), 700);
    return () => clearTimeout(timer);
  }, [revealed, animate]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyEmail() {
    if (!person) return;
    try {
      await navigator.clipboard.writeText(person.email);
      setCopied(true);
    } catch {
      // 沒有剪貼簿權限就算了，底下的 mailto 連結仍然是一條路。
    }
  }

  return (
    // 卡片鎖寬：不鎖的話桌機上會被撐成 672px 寬的橫幅，
    // 直式卡的比例（18rem × 22rem）就沒了。
    <div className="w-full max-w-[18rem] [perspective:1200px]">
      <div
        className={`relative min-h-[22rem] w-full [transform-style:preserve-3d] motion-safe:transition-transform motion-safe:duration-700 ${
          revealed ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* 背面：活動現場靠這一面找人 */}
        <div
          className={`flex min-h-[22rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-foreground ${tone} p-6 text-center shadow-[4px_4px_0_0_var(--color-foreground)] [backface-visibility:hidden]`}
        >
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            你們這一組的徽記
          </span>
          <span className="text-7xl leading-none" role="img" aria-label={badge.name}>
            {badge.emoji}
          </span>
          <span className="text-4xl font-extrabold tracking-tight">{badge.name}</span>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            現場找到同樣是「{badge.name}」的人，就是你的直屬
          </p>
        </div>

        {/* 正面：相認之後才看得到 */}
        <div
          aria-live="polite"
          className={`stagger absolute inset-0 flex min-h-[22rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-foreground bg-card p-6 text-center shadow-[4px_4px_0_0_var(--color-foreground)] [backface-visibility:hidden] [transform:rotateY(180deg)] ${
            contentIn ? "revealed" : ""
          }`}
        >
          <span
            className={`flex h-24 w-24 items-center justify-center rounded-full border-2 border-foreground ${tone} text-5xl shadow-[3px_3px_0_0_var(--color-foreground)]`}
            role="img"
            aria-label={badge.name}
          >
            {badge.emoji}
          </span>
          <span className="text-3xl font-extrabold tracking-tight">
            {person?.name}
          </span>
          <Badge className="bg-tone-green-badge">{person?.grade}</Badge>
          <div className="flex items-center gap-2">
            <a
              href={`mailto:${person?.email}`}
              className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground underline decoration-2 underline-offset-4 hover:text-foreground"
            >
              <Mail className="size-4 shrink-0" aria-hidden />
              {person?.email}
            </a>
            <button
              type="button"
              onClick={copyEmail}
              aria-label={copied ? "已複製信箱" : "複製信箱"}
              className="rounded-md border-2 border-foreground bg-card p-1 transition-colors hover:bg-muted"
            >
              {copied ? (
                <Check className="size-4 text-tone-green-text" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
