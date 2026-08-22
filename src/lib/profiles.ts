// 「這個人想對揭曉他的人說的話」——IG 與一段留言。
//
// 為什麼另開一個檔而不是塞進 pairs.json：pairs.json 是 `pnpm sync` 的產物，
// 每次從 Excel 重生一次，手寫的東西會被蓋掉（徽記與碼是靠 sync 特地沿用才活著的）。
// 這份是人手維護的，跟配對表各自獨立，sync 不碰它。
//
// 形狀同 pairs.ts：server-only + runtime fs 讀檔 + mtime 快取，
// 換檔案 → 重整頁面即生效，不必重新部署。
import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface Profile {
  // IG 帳號，不含 @ 也不含網址（顯示與連結都從這裡推）。
  instagram?: string;
  // 一段話，揭曉之後顯示在卡片下方。
  note?: string;
}

// email（小寫）→ profile。名單上絕大多數人沒有這一項，沒有就是沒有。
type ProfileMap = Record<string, Profile>;

// 靜態路徑，理由同 pairs.ts：Turbopack 的檔案追蹤看得懂這個形式。
const DATA_PATH = path.join(process.cwd(), "data", "profiles.json");

const EMPTY: ProfileMap = {};

let cache: { mtimeMs: number; data: ProfileMap } | null = null;

async function load(): Promise<ProfileMap> {
  try {
    const { mtimeMs } = await stat(DATA_PATH);
    if (cache?.mtimeMs === mtimeMs) return cache.data;

    const parsed = JSON.parse(await readFile(DATA_PATH, "utf8")) as ProfileMap;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("profiles 不是物件");
    }

    cache = { mtimeMs, data: parsed };
    return parsed;
  } catch (error) {
    // 檔案不存在 = 沒有人留言，不是錯誤。
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error(`[profiles] 讀取 ${DATA_PATH} 失敗：`, error);
    }
    cache = null;
    return EMPTY;
  }
}

export async function profileOf(email: string): Promise<Profile | null> {
  const profiles = await load();
  const found = profiles[email.trim().toLowerCase()];
  // 兩個欄位都空的等於沒有，讓上層只要判斷 null。
  if (!found?.instagram && !found?.note) return null;
  return found;
}
