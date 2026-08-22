// 本機「附身」：用名單上任何一個人的身分看畫面，不必真的登入成他。
//
//   .env.local：BUDDY_DEV_AS=陳伯軒        （姓名或信箱都行）
//
// 為什麼需要：個人頁只顯示「你自己那一組」，要驗證某個人看到的長什麼樣
// （例如他的直屬有沒有留言、卡片會不會爆版），除了附身沒有別的辦法——
// 總不能去要別人的 Google 帳號密碼。
//
// ★ 生產環境永遠是 null，兩道鎖：★
//   1. NODE_ENV === "production" 直接回 null。Next 會把它 inline 成常數，
//      正式 build 裡這整段是死碼，被搖掉。
//   2. 主機的 .env.local 根本沒有 BUDDY_DEV_AS 這顆。
// 每次生效都印一行 warn，免得自己忘了開著它在那邊 debug 一小時。
import "server-only";
import { authConfig } from "@/config/auth";
import { loadPairs, type Person } from "@/lib/pairs";
import type { TPassClaims } from "@/lib/tpass-auth";

// 名單裡找人：信箱優先（唯一），找不到再比對姓名（同名就取第一個並抱怨一聲）。
// 學號信箱沒人記得住，所以姓名一定要能用。
async function findPerson(wanted: string): Promise<Person | null> {
  const needle = wanted.trim().toLowerCase();
  const { pairs } = await loadPairs();
  const people = pairs.flatMap(({ junior, senior }) => [junior, senior]);

  const byEmail = people.find((p) => p.email.toLowerCase() === needle);
  if (byEmail) return byEmail;

  const byName = people.filter((p) => p.name.trim().toLowerCase() === needle);
  if (byName.length > 1) {
    console.warn(`[dev-as] 名單上有 ${byName.length} 個「${wanted}」，取第一個。要精確就改用信箱。`);
  }
  return byName[0] ?? null;
}

export async function devSession(): Promise<TPassClaims | null> {
  if (process.env.NODE_ENV === "production") return null;

  const wanted = process.env.BUDDY_DEV_AS?.trim();
  if (!wanted) return null;

  const person = await findPerson(wanted);
  if (!person) {
    console.error(`[dev-as] 配對表裡找不到「${wanted}」，附身沒生效（還是你自己的 cookie）。`);
    return null;
  }

  console.warn(`[dev-as] ⚠️ 本次請求以「${person.name}」的身分處理（BUDDY_DEV_AS）`);

  return {
    sub: `dev-as:${person.email}`,
    email: person.email,
    name: person.name,
    // 附身就是看「這個人看到什麼」，所以權限給一般使用者，不給 admin。
    permissions: { [authConfig.serviceId]: { read: true, role: "default" } },
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
}
