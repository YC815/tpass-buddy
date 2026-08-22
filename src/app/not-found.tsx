// 中性 404：錯誤的 /roster/<token> 也走這裡，畫面不能透露總表存在。
// 這頁會被靜態產生（/_not-found），所以不讀 session——導覽列一律用未登入版。
import { authConfig } from "@/config/auth";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { Card } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <>
      <Header
        isLoggedIn={false}
        loginUrl={authConfig.loginUrl}
        logoutUrl={authConfig.logoutUrl}
        portalUrl={authConfig.portalUrl}
      />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <Card className="flex flex-col gap-2">
          <p className="font-mono text-xs font-bold tracking-widest text-muted-foreground">
            404
          </p>
          <p className="text-lg font-bold">找不到這個頁面</p>
          <a
            href={authConfig.portalUrl}
            className="text-sm font-bold text-muted-foreground underline decoration-2 underline-offset-4 hover:text-foreground"
          >
            回大廳
          </a>
        </Card>
      </main>

      <Footer />
    </>
  );
}
