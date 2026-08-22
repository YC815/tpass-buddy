// 「這一對現在該不該顯示真名」的**唯一判斷點**。
//
// 這個問題有三個來源（現場相認、兜底時間、手動開關），散進各元件就會出現
// 「頁面說已揭曉但 API 說沒有」這種對不起來的狀態。所以只有這一支函式回答它，
// page 與兩支 API route 都問這裡。
//
// 判斷順序：
//   BUDDY_FORCE_REVEAL=true   → 全開（不管時間、不管有沒有相認）
//   BUDDY_FORCE_REVEAL=false  → 強制鎖（即使過了時間，仍只能靠現場相認）
//   未設                        → 過了 BUDDY_REVEAL_AT 就全開，否則看 reveals.json
//
// 兜底時間存在的理由：沒到場、沒相認到的人不能永遠看不到自己的直屬。
import "server-only";
import type { Lookup } from "@/lib/pairs";
import { revealKey, revealedKeys } from "@/lib/reveals";

function forceFlag(): boolean | null {
  const raw = process.env.BUDDY_FORCE_REVEAL?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null; // 未設或值看不懂 → 交給時間判斷
}

function pastRevealTime(): boolean {
  const raw = process.env.BUDDY_REVEAL_AT?.trim();
  if (!raw) return false;

  const at = Date.parse(raw);
  if (Number.isNaN(at)) {
    // 打錯字不該讓全場提前解鎖，所以往「還沒到」倒。
    console.error(`[reveal-policy] BUDDY_REVEAL_AT 不是合法時間：${raw}`);
    return false;
  }
  return Date.now() >= at;
}

// 對照 lookup.pairs 的順序回傳每一對是否已揭曉。
export async function revealFlagsFor(lookup: Lookup): Promise<boolean[]> {
  const force = forceFlag();
  if (force === true) return lookup.pairs.map(() => true);

  // force === false 時跳過時間判斷，只認現場相認。
  if (force === null && pastRevealTime()) return lookup.pairs.map(() => true);

  const done = await revealedKeys();
  return lookup.pairs.map((pair) =>
    done.has(revealKey(pair.junior.email, pair.senior.email)),
  );
}
