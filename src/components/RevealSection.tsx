"use client";

// 個人頁的主體：標題、我的 QR/配對碼、徽記卡、掃描器、confetti、輪詢。
//
// ★ 資料邊界（最重要的一條）★
// props 裡未揭曉的卡**只有徽記**，沒有對方的姓名 email。傳進 client component 的東西
// 會完整出現在 HTML 的 RSC payload 裡，「不顯示」擋不住看原始碼的人。
// 對方資料只會在 server 端確認這一對已相認之後才進到 cards——由 page.tsx 負責把關。
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareHeart, QrCode, ScanLine } from "lucide-react";
import { BadgeCard, type RevealedPerson } from "@/components/BadgeCard";
import { CodeInput } from "@/components/CodeInput";
import { Scanner } from "@/components/Scanner";
import { Button, Card } from "@/components/ui/primitives";
import { fireConfetti } from "@/lib/confetti";
import type { BadgeMark, Role } from "@/lib/pairs";

export interface RevealCard {
  badge: BadgeMark;
  person: RevealedPerson | null; // null = 還沒相認
}

// lucide 1.x 沒有品牌圖示（Instagram 在裡面找不到），所以自己畫一個。
// 幾何形狀 + currentColor stroke + 2px 線寬，跟這頁其他 lucide 圖示同一套。
function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const POLL_MS = 3000;

const ERRORS: Record<string, string> = {
  not_your_buddy: "這不是你的直屬，再找找看",
  too_many_attempts: "試太多次了，等一分鐘再來",
  bad_code: "配對碼是六位數字",
  not_in_roster: "你不在這次的名單上",
  unauthorized: "登入過期了，重新整理一次",
};

export function RevealSection({
  userName,
  role,
  myCode,
  qrSvg,
  cards,
}: {
  userName: string;
  role: Role;
  myCode: string;
  qrSvg: string;
  cards: RevealCard[];
}) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const deckRef = useRef<HTMLDivElement>(null);
  // 上一次看到的揭曉狀態。用來分辨「剛剛翻開」與「本來就開著」——
  // 後者是重整進來的，不該重播動畫也不該再噴一次彩帶。
  const seen = useRef(cards.map((c) => c.person !== null));
  const [justRevealed, setJustRevealed] = useState<boolean[]>(() =>
    cards.map(() => false),
  );

  const allRevealed = cards.every((c) => c.person !== null);

  // 有卡從「沒人」變成「有人」→ 播動畫 + 彩帶。
  // 自己掃到、被對方掃到（輪詢刷新）都會走到這裡，不必分兩條路。
  useEffect(() => {
    const now = cards.map((c) => c.person !== null);
    const fresh = now.map((open, i) => open && !seen.current[i]);
    seen.current = now;
    if (!fresh.some(Boolean)) return;

    setJustRevealed((prev) => prev.map((was, i) => was || fresh[i]));
    if (deckRef.current) fireConfetti(deckRef.current);
  }, [cards]);

  // 對方掃了我之後，我這邊自己翻開，不必叫使用者重整。
  // 全開就停；分頁切走也停（省電，也省得回來時一次噴一堆請求）。
  //
  // 輪詢問的是 /api/reveal/status（薄端點，只回揭曉旗標、不回姓名），
  // **狀態真的翻了才** router.refresh()。原本每 3 秒無條件 refresh 一次，
  // 等於每分鐘重跑 20 次整頁 server render——連帶把 admin 的瀏覽計次灌爆
  // （實測一個人 3.5 分鐘記了 52 次）。等待中的人不該在統計裡留下任何痕跡。
  useEffect(() => {
    if (allRevealed) return;

    let stopped = false;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/reveal/status", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { revealed?: unknown };
        if (stopped || !Array.isArray(body.revealed)) return;
        // 有任何一格從「沒開」變「開」→ 交給 server 重新組資料（姓名只從那裡來）。
        if (body.revealed.some((open, i) => open && !seen.current[i])) {
          router.refresh();
        }
      } catch {
        // 網路瞬斷不必吵使用者，下一輪再問。
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [allRevealed, router]);

  const submit = useCallback(
    async (code: string): Promise<boolean> => {
      setBusy(true);
      setNotice(null);
      try {
        const res = await fetch("/api/reveal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setNotice(ERRORS[body?.error ?? ""] ?? "相認失敗，再試一次");
          return false;
        }
        // 卡片內容一律以 server 為準：refresh 之後 page 會把對方資料放進 cards，
        // 上面那個 effect 就會接手播動畫。這裡不自己塞資料，免得兩份真相對不起來。
        setScanning(false);
        router.refresh();
        return true;
      } catch {
        setNotice("連不上伺服器，檢查一下網路");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const heading = allRevealed
    ? role === "junior"
      ? "你的直屬學長姐是——"
      : "你的直屬學弟妹是——"
    : `嗨，${userName}`;

  return (
    <>
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
          T-Buddy 直屬配對
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">{heading}</h1>
      </header>

      {/* 我的身分：對方掃這個 QR（或打這組碼）就能跟我相認 */}
      {!allRevealed && (
        <Card className="flex w-full max-w-sm items-center gap-4 self-center">
          <span
            className="size-24 shrink-0 [&>svg]:size-full"
            aria-label="你的配對 QR code"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <QrCode className="size-3.5" aria-hidden />
              讓對方掃你
            </span>
            <span className="font-mono text-2xl font-bold tracking-[0.2em]">
              {myCode}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              掃不到就唸這組碼給對方打
            </span>
          </div>
        </Card>
      )}

      {/* flex + justify-center 而不是 grid-cols-2：
          只有一張卡時 grid 會把它釘在左半邊，看起來像沒排好。 */}
      <div ref={deckRef} className="flex flex-wrap justify-center gap-4">
        {cards.map((card, i) => (
          <BadgeCard
            key={card.badge.emoji}
            badge={card.badge}
            person={card.person}
            animate={justRevealed[i]}
          />
        ))}
      </div>

      {/* 對方留給揭曉者的話與他的 IG。沒留就整塊不存在——名單上絕大多數人都是這樣。
          整包放在牌組下面而不是卡片正面：留言是段落，塞進 22rem 的卡會爆版；
          IG 也跟著留言走，因為它是「這個人想對你說的」的一部分，不是聯絡資訊欄位。 */}
      {cards.map((card) => {
        const profile = card.person?.profile;
        if (!profile) return null;
        return (
          <Card
            key={card.badge.emoji}
            className="flex w-full max-w-sm flex-col items-start gap-3 self-center"
          >
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <MessageSquareHeart className="size-3.5" aria-hidden />
              {card.person?.name} 想對你說
            </span>
            {profile.note && (
              <p className="text-sm font-medium leading-relaxed">{profile.note}</p>
            )}
            {profile.instagram && (
              <a
                href={`https://instagram.com/${profile.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-tone-violet-bg px-3 py-1.5 font-mono text-sm font-bold text-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]"
              >
                <InstagramGlyph className="size-4 shrink-0" />
                @{profile.instagram}
              </a>
            )}
          </Card>
        );
      })}

      {!allRevealed && (
        <Card className="flex w-full max-w-sm flex-col items-center gap-3 self-center bg-muted text-center">
          <p className="font-bold">找到人了？其中一個人掃另一個就好</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => {
                setNotice(null);
                setScanning(true);
              }}
              className="gap-2"
            >
              <ScanLine className="size-4" />
              掃描對方的 QR
            </Button>
            <CodeInput onSubmit={submit} disabled={busy} />
          </div>
          {notice && !scanning && (
            <p className="text-sm font-bold text-destructive">{notice}</p>
          )}
        </Card>
      )}

      {scanning && (
        <Scanner
          onCode={submit}
          onClose={() => setScanning(false)}
          notice={notice}
        />
      )}
    </>
  );
}
