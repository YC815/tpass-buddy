// Server 端守門。
import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSession, permOf, type TPassClaims } from "@/lib/tpass-auth";
import { loginUrlFor, deniedUrlFor } from "@/config/auth";

export async function requireSession(returnPath = "/"): Promise<TPassClaims> {
  const session = await getSession();
  if (!session) redirect(loginUrlFor(returnPath));
  // ban（read:false）→ 導去 auth 的 /denied 看原因；reason 不經過這裡，denied 頁自己重查。
  if (!permOf(session).read) redirect(deniedUrlFor());
  return session;
}

// /admin 專用。名單在 auth 的 /admin panel 管（permissions.buddy.role），
// 本服務不自維護 allowlist、不吃 env。
//
// 非 admin 走 notFound() 而不是「無權限」畫面：這頁的存在本身沒必要對全校公開，
// 理由同 /roster/<token> 的中性 404。
export async function requireAdmin(returnPath = "/admin"): Promise<TPassClaims> {
  const session = await requireSession(returnPath);
  if (permOf(session).role !== "admin") notFound();
  return session;
}
