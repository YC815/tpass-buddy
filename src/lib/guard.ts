// Server 端守門。buddy 沒有管理介面，所以只有 requireSession 一支
//（appeals 的 requireAdmin / requireSuperAdmin 在這裡沒有對應需求，不抄）。
import "server-only";
import { redirect } from "next/navigation";
import { getSession, permOf, type TPassClaims } from "@/lib/tpass-auth";
import { loginUrlFor, deniedUrlFor } from "@/config/auth";

export async function requireSession(returnPath = "/"): Promise<TPassClaims> {
  const session = await getSession();
  if (!session) redirect(loginUrlFor(returnPath));
  // ban（read:false）→ 導去 auth 的 /denied 看原因；reason 不經過這裡，denied 頁自己重查。
  if (!permOf(session).read) redirect(deniedUrlFor());
  return session;
}
