// 「這一對現在該不該顯示真名」的**唯一判斷點**。
//
// 這個問題有四個來源（env 逃生口、後台開關、兜底時間、現場相認），散進各元件就會出現
// 「頁面說已揭曉但 API 說沒有」這種對不起來的狀態。所以只有這一支函式回答它，
// page 與兩支 API route 都問這裡。
//
// 判斷順序：
//   BUDDY_FORCE_REVEAL=true   → 全開（不管其他一切）
//   BUDDY_FORCE_REVEAL=false  → 強制鎖（連後台開關都蓋不過，只能靠現場相認）
//   event.json 的 publicReveal → 全開（後台一鍵，主持人現場按的就是這顆）
//   過了 BUDDY_REVEAL_AT       → 全開
//   以上都不成立               → 查 reveals.json，只有現場相認過的那一對才翻開
//
// env 兩顆刻意留在最高優先：後台按壞了、JSON 寫壞了，ssh 上機改 .env.local 仍然救得回來。
// 兜底時間存在的理由：沒到場、沒相認到的人不能永遠看不到自己的直屬。
import "server-only";
import type { Lookup } from "@/lib/pairs";
import { eventState } from "@/lib/event";
import { revealKey, revealedKeys } from "@/lib/reveals";

function forceFlag(): boolean | null {
  const raw = process.env.BUDDY_FORCE_REVEAL?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null; // 未設或值看不懂 → 交給後面的判斷
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
  const all = (open: boolean) => lookup.pairs.map(() => open);

  const force = forceFlag();
  if (force === true) return all(true);

  if (force === null) {
    // 後台開關。平日的預設值就是 true，所以進站直接看到直屬是誰。
    if ((await eventState()).publicReveal) return all(true);
    if (pastRevealTime()) return all(true);
  }

  const done = await revealedKeys();
  return lookup.pairs.map((pair) =>
    done.has(revealKey(pair.junior.email, pair.senior.email)),
  );
}
