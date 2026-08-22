// 總表：免登入，靠不可猜的路徑保護（BUDDY_ROSTER_TOKEN，openssl rand -hex 16）。
// 給籌備的內部人士核對用，所以刻意不放信箱——要聯絡的人自己在個人頁看得到。
//
// token 用單純 !== 比對：128 bit 的隨機字串猜不出來，HTTPS 的網路抖動遠大於
// 字串比對的時間差，加 timingSafeEqual 只是讓讀的人多花時間。
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { authConfig } from "@/config/auth";
import { loadPairs, rosterBySenior } from "@/lib/pairs";
import { RosterSearch } from "@/components/RosterSearch";
import { Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (token !== authConfig.rosterToken) notFound();

  const [groups, { version, syncedAt }] = await Promise.all([
    rosterBySenior(),
    loadPairs(),
  ]);
  const total = groups.reduce((sum, g) => sum + g.juniors.length, 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-10">
      <header className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Users className="size-4" aria-hidden />
          T-Buddy 總表
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">直屬配對名單</h1>
        <p className="font-mono text-xs text-muted-foreground">
          {version}｜{groups.length} 位學長姐｜{total} 位新生
          {syncedAt && `｜更新於 ${new Date(syncedAt).toLocaleString("zh-TW")}`}
        </p>
      </header>

      {groups.length === 0 ? (
        <Card className="bg-muted">
          <p className="font-bold">目前沒有資料</p>
          <p className="text-sm text-muted-foreground">
            主機上還沒有 data/pairs.json，先在本機跑 pnpm sync 再 pnpm push:data。
          </p>
        </Card>
      ) : (
        <RosterSearch groups={groups} />
      )}
    </main>
  );
}
