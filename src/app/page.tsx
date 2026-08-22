// 個人頁：登入後只看得到「自己那一組」。
// 全班名單在 /roster/<token>，那是另一條路，這裡永遠不會洩漏第三人的資料。
import { HeartHandshake, LogIn } from "lucide-react";
import { authConfig } from "@/config/auth";
import { requireSession } from "@/lib/guard";
import { getSession } from "@/lib/tpass-auth";
import { lookupByEmail } from "@/lib/pairs";
import { PersonCard } from "@/components/PersonCard";
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
  const result = await lookupByEmail(session.email);

  return (
    <>
      <Header
        isLoggedIn
        userName={session.name}
        userEmail={session.email}
        loginUrl={authConfig.loginUrl}
        logoutUrl={authConfig.logoutUrl}
        portalUrl={authConfig.portalUrl}
      />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
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
      </main>

      <Footer />
    </>
  );
}
