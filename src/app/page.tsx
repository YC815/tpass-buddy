// 個人頁：登入後只看得到「自己那一組」。
// 全班名單在 /roster/<token>，那是另一條路，這裡永遠不會洩漏第三人的資料。
import Link from "next/link";
import { ArrowLeft, HeartHandshake } from "lucide-react";
import { authConfig } from "@/config/auth";
import { requireSession } from "@/lib/guard";
import { lookupByEmail } from "@/lib/pairs";
import { PersonCard } from "@/components/PersonCard";
import { Button, Card } from "@/components/ui/primitives";

// 資料是 runtime 讀檔的，別讓 Next 把這頁靜態化（換了 pairs.json 才會立刻生效）。
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireSession("/");
  const result = await lookupByEmail(session.email);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <HeartHandshake className="size-4" aria-hidden />
          T-Buddy 直屬配對
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">
          嗨，{session.name}
        </h1>
      </header>

      {result === null ? (
        <Card className="flex flex-col gap-2 bg-muted">
          <p className="text-lg font-bold">找不到你的配對資料</p>
          <p className="text-sm text-muted-foreground">
            這份名單只包含這次直屬活動的新生與學長姐。若你應該在名單上，請洽學生會。
          </p>
        </Card>
      ) : result.role === "junior" ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-muted-foreground">
            你的直屬學長姐
          </h2>
          <PersonCard person={result.senior} />
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-muted-foreground">
            你的直屬學弟妹（{result.juniors.length} 位）
          </h2>
          {result.juniors.map((person) => (
            <PersonCard key={person.email} person={person} />
          ))}
        </section>
      )}

      <footer className="mt-auto flex items-center justify-between gap-3 pt-6">
        <Link
          href={authConfig.portalUrl}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          回大廳
        </Link>
        <form method="post" action={authConfig.logoutUrl}>
          <Button type="submit" size="sm">
            登出
          </Button>
        </form>
      </footer>
    </main>
  );
}
