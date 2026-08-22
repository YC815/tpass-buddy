// 管理頁：誰點進來看過自己的直屬、看了幾次。
//
// 進得來的條件是 JWT 裡 permissions.buddy.role === "admin"（名單在 auth 的 /admin panel 管）。
// 非 admin 一律 404，不透露這頁存在——同 /roster/<token> 的中性 404。
//
// 只讀，沒有任何寫入或匯出。名單以 pairs.json 為準：沒看到直屬的人才會顯示成 0 次，
// 這正是這頁存在的理由（「誰還沒看」只能從名單那一側算出來）。
//
// 「看過」的定義＝頁面真的把直屬揭曉給他看（見 src/app/page.tsx 的計次點）。
// 還沒相認、停在徽記畫面的那些 render 不計次，否則這欄會變成「登入過沒」。
import { Eye, EyeOff, Users, MousePointerClick } from "lucide-react";
import { authConfig } from "@/config/auth";
import { requireAdmin } from "@/lib/guard";
import { participants } from "@/lib/pairs";
import { revealKey, revealedKeys } from "@/lib/reveals";
import { allViews } from "@/lib/views";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { Badge, Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

// 活動在台北，管理者也在台北——時間一律以台北時區呈現，不看主機的 TZ。
const TIME_FMT = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-3xl font-extrabold tracking-tight">{value}</span>
      {hint ? (
        <span className="text-xs font-medium text-muted-foreground">{hint}</span>
      ) : null}
    </Card>
  );
}

export default async function AdminPage() {
  const session = await requireAdmin();

  const [people, views, revealed] = await Promise.all([
    participants(),
    allViews(),
    revealedKeys(),
  ]);

  // participants() 已按年級 → 姓名排好；JS 的 sort 是穩定的，
  // 所以這裡只要再把「次數少的」往前挪，同次數的人就會保留原本的年級姓名序。
  const rows = people
    .map((person) => {
      const stat = views[person.email];
      const revealedCount = person.pairs.filter((pair) =>
        revealed.has(revealKey(pair.junior.email, pair.senior.email)),
      ).length;
      return { person, count: stat?.count ?? 0, lastAt: stat?.lastAt, revealedCount };
    })
    .sort((a, b) => a.count - b.count);

  const seen = rows.filter((r) => r.count > 0).length;
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const pct = rows.length === 0 ? 0 : Math.round((seen / rows.length) * 100);

  return (
    <>
      <Header
        isLoggedIn
        userName={session.name}
        userEmail={session.email}
        loginUrl={authConfig.loginUrl}
        logoutUrl={authConfig.logoutUrl}
        portalUrl={authConfig.portalUrl}
        isAdmin
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">瀏覽狀況</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            名單上每個人有沒有真的看到自己的直屬、看了幾次。只有頁面實際揭曉的那一次才計數——
            停在徽記畫面等相認不算，所以「還沒看」包含「進來過但還沒相認」。計次從這個功能上線
            那一刻起算，之前的瀏覽沒有紀錄。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={<Users className="h-3.5 w-3.5" />}
            label="名單人數"
            value={String(rows.length)}
          />
          <Stat
            icon={<Eye className="h-3.5 w-3.5" />}
            label="看過"
            value={String(seen)}
            hint={`${pct}%`}
          />
          <Stat
            icon={<EyeOff className="h-3.5 w-3.5" />}
            label="還沒看"
            value={String(rows.length - seen)}
          />
          <Stat
            icon={<MousePointerClick className="h-3.5 w-3.5" />}
            label="總次數"
            value={String(total)}
          />
        </div>

        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-foreground text-left font-mono text-[11px] tracking-widest text-muted-foreground">
                <th className="px-4 py-3 font-bold">姓名</th>
                <th className="px-4 py-3 font-bold">身分</th>
                <th className="px-4 py-3 text-right font-bold">次數</th>
                <th className="px-4 py-3 font-bold">最後一次</th>
                <th className="px-4 py-3 font-bold">相認</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ person, count, lastAt, revealedCount }) => (
                <tr
                  key={person.email}
                  className="border-b-2 border-foreground/10 last:border-b-0"
                >
                  <td className="px-4 py-3 font-bold">{person.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {person.grade}・{person.role === "junior" ? "新生" : "學長姐"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {count === 0 ? (
                      <Badge className="bg-muted text-muted-foreground">未看</Badge>
                    ) : (
                      <span className="font-mono font-bold">{count}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {lastAt ? TIME_FMT.format(new Date(lastAt)) : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {revealedCount}/{person.pairs.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm font-medium text-muted-foreground">
              名單是空的（data/pairs.json 還沒上機或讀不到）。
            </p>
          ) : null}
        </Card>
      </main>

      <Footer />
    </>
  );
}
