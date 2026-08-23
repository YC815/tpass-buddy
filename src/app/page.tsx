// 個人頁：登入後只看得到「自己那一組」。
// 全班名單在 /roster/<token>，那是另一條路，這裡永遠不會洩漏第三人的資料。
import QRCode from "qrcode";
import { LogIn } from "lucide-react";
import { authConfig } from "@/config/auth";
import { requireSession } from "@/lib/guard";
import { getSession, permOf } from "@/lib/tpass-auth";
import { loadPairs, lookupByEmail, otherOf, pairKeyOf } from "@/lib/pairs";
import { profileOf } from "@/lib/profiles";
import { codeOf, eventState } from "@/lib/event";
import { boardOf, finishedPairKeys, teamKeyOf } from "@/lib/standings";
import { revealFlagsFor } from "@/lib/reveal-policy";
import { recordView } from "@/lib/views";
import {
  RevealSection,
  type RaceProps,
  type RevealCard,
} from "@/components/RevealSection";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { Card } from "@/components/ui/primitives";

// 資料是 runtime 讀檔的，別讓 Next 把這頁靜態化（換了 pairs.json 才會立刻生效）。
export const dynamic = "force-dynamic";

// 登出後的落地畫面。不能在這裡導回登入，否則使用者永遠登不出去。
function LoggedOutNotice() {
  return (
    <>
      <Header
        isLoggedIn={false}
        loginUrl={authConfig.loginUrl}
        logoutUrl={authConfig.logoutUrl}
        portalUrl={authConfig.portalUrl}
      />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 py-24 text-center sm:px-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground bg-card text-foreground shadow-[4px_4px_0_0_var(--color-foreground)]">
          <LogIn className="h-8 w-8" />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">您已登出</h1>
        <p className="mt-2 font-medium text-muted-foreground">
          您已安全登出 T-Buddy。要再查一次自己的直屬，請重新登入。
        </p>
        <a
          href={authConfig.loginUrl}
          className="mt-6 inline-flex items-center gap-2.5 rounded-xl border-2 border-foreground bg-primary px-4 py-2 font-bold text-primary-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]"
        >
          使用學校帳號登入
        </a>
      </main>

      <Footer />
    </>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ logout?: string }>;
}) {
  // 剛登出（auth 導回來帶 ?logout=1）時不能再導去登入，否則會被立刻彈回去、等於登不出去。
  // logout=1 只是畫面提示、不是憑證，所以仍要確認 session 真的無效才採信。
  const { logout } = await searchParams;
  if (logout === "1" && !(await getSession())) return <LoggedOutNotice />;

  const session = await requireSession("/");

  const lookup = await lookupByEmail(session.email);

  let body: React.ReactNode;
  if (lookup === null) {
    body = (
      <Card className="flex w-full max-w-sm flex-col gap-2 self-center bg-muted text-center">
        <p className="text-lg font-bold">找不到你的配對資料</p>
        <p className="text-sm text-muted-foreground">
          這份名單只包含這次直屬活動的新生與學長姐。若你應該在名單上，請洽學生會。
        </p>
      </Card>
    );
  } else {
    const flags = await revealFlagsFor(lookup);

    // 計次點就在這裡，而且只在「這次 render 真的揭曉了誰」時才算。
    // admin 那頁問的是「誰還沒看到自己的直屬」，所以停在徽記等相認的畫面
    // 不算——把它算進去，「看過」就退化成「登入過」。
    // 這頁是 force-dynamic，一次 render ＝ 一次瀏覽；等待期間的輪詢改問
    // /api/reveal/status，只有狀態真的翻了才 router.refresh()，不會灌水
    // （舊版每 3 秒 refresh 一次，實測 3.5 分鐘就記了 52 次）。
    // 另一個失真來源是 <Link href="/"> 的自動預取，所以 Header 那顆設了 prefetch={false}。
    // 計次寫檔失敗不該讓人看不到自己的直屬，所以吞掉錯誤只留 log。
    if (flags.some(Boolean)) {
      await recordView(session.email).catch((error) => {
        console.error("[views] 記錄瀏覽失敗：", error);
      });
    }

    // ★ 個資邊界就在這一行 ★
    // 沒揭曉的配對只放徽記，person 給 null。RevealSection 是 client component，
    // 它收到的每個欄位都會出現在 HTML 的 RSC payload 裡——所以對方的姓名與信箱
    // 必須在「確認這一對已相認」之後才被放進來，不能靠前端不顯示。
    // profile（IG／留言）跟姓名信箱一樣是對方的資料，所以走同一道門：
    // 揭曉之後才讀、才放進來。
    const cards: RevealCard[] = await Promise.all(
      lookup.pairs.map(async (pair, i) => {
        if (!flags[i]) return { badge: pair.badge, person: null };
        const person = otherOf(pair, lookup.role);
        return {
          badge: pair.badge,
          person: {
            name: person.name,
            email: person.email,
            grade: person.grade,
            profile: await profileOf(person.email),
          },
        };
      }),
    );

    // 我的碼屬於我這個人，不是屬於某一組配對——帶 2 位學弟妹的學長姐也只有一組。
    //
    // 比賽期間拿的是「本場的碼」：每次鳴槍都整批重擲（src/lib/event.ts），
    // 所以賽前截的圖一律失效。還沒比過任何一場就退回 pairs.json 的原碼。
    const state = await eventState();
    const me =
      lookup.role === "junior" ? lookup.pairs[0].junior : lookup.pairs[0].senior;
    const myCode = codeOf(state, me.email, me.code);

    // 比賽區塊。待命中就整塊不存在，個人頁跟平常一模一樣。
    // 只放「自己這一隊」的名次——別人的成績在大螢幕上，不從這裡外流。
    //
    // 計分看隊（一位學長姐，取最早找到的那一位），相認看對（每一對都要掃）：
    // 所以名次只有一個，但 pending 可能還有 1（帶 2 位學弟妹的學長姐找到第一位之後）。
    let race: RaceProps | null = null;
    if (state.phase !== "idle") {
      const { pairs } = await loadPairs();
      const board = boardOf(state, pairs);
      const myTeam = teamKeyOf(lookup.pairs);
      const hit = board.standings.find((s) => s.seniorKey === myTeam);
      const scanned = finishedPairKeys(state);
      race = {
        phase: state.phase,
        startedAt: state.startedAt,
        serverNow: new Date().toISOString(),
        total: board.total,
        finish: hit ? { rank: hit.rank, ms: hit.ms } : null,
        pending: lookup.pairs.filter((p) => !scanned.has(pairKeyOf(p))).length,
      };
    }

    // QR 在 server 端產 SVG 直接內嵌，client 不必為此載任何東西。
    // 裡面編的就是那六位數碼，沒有姓名也沒有信箱。
    const qrSvg = await QRCode.toString(myCode, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
    });

    body = (
      <RevealSection
        userName={session.name}
        role={lookup.role}
        myCode={myCode}
        qrSvg={qrSvg}
        cards={cards}
        race={race}
      />
    );
  }

  return (
    <>
      <Header
        isLoggedIn
        userName={session.name}
        userEmail={session.email}
        loginUrl={authConfig.loginUrl}
        logoutUrl={authConfig.logoutUrl}
        portalUrl={authConfig.portalUrl}
        isAdmin={permOf(session).role === "admin"}
      />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-8 px-4 py-10 sm:px-6">
        {body}
      </main>

      <Footer />
    </>
  );
}
