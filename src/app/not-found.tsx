// 中性 404：錯誤的 /roster/<token> 也走這裡，畫面不能透露總表存在。
import Link from "next/link";
import { authConfig } from "@/config/auth";
import { Card } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <Card className="flex flex-col gap-2">
        <p className="font-mono text-xs font-bold tracking-widest text-muted-foreground">
          404
        </p>
        <p className="text-lg font-bold">找不到這個頁面</p>
        <Link
          href={authConfig.portalUrl}
          className="text-sm font-bold text-muted-foreground underline decoration-2 underline-offset-4 hover:text-foreground"
        >
          回大廳
        </Link>
      </Card>
    </main>
  );
}
