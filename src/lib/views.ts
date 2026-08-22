// 「誰點進來看過自己的直屬、看了幾次」的持久層。
//
// 形狀刻意對照 src/lib/reveals.ts：一樣 server-only + runtime fs 讀檔、一樣放在
// gitignored 的 data/ 底下、一樣單一 promise chain 序列化寫入（pm2 fork mode /
// instances:1，全站單一 process，沒有跨 process 競爭）。活動結束 rm -rf 一併消失。
//
// 與 reveals 的唯一結構差異：這裡存成 map 而不是陣列。操作是「照 email 查一個人並 +1」，
// 陣列每次都要 filter；map 直接命中。
import "server-only";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ViewStat {
  count: number;
  firstAt: string; // ISO 8601
  lastAt: string; // ISO 8601
}

interface ViewData {
  views: Record<string, ViewStat>;
}

// 靜態路徑，理由同 pairs.ts：Turbopack 的檔案追蹤看得懂這個形式。
const DATA_PATH = path.join(process.cwd(), "data", "views.json");
const TMP_PATH = `${DATA_PATH}.tmp`;

const EMPTY: ViewData = { views: {} };

// mtime 當快取鍵，同 reveals.ts。寫入時會主動失效。
let cache: { mtimeMs: number; data: ViewData } | null = null;

async function load(): Promise<ViewData> {
  try {
    const { mtimeMs } = await stat(DATA_PATH);
    if (cache?.mtimeMs === mtimeMs) return cache.data;

    const parsed = JSON.parse(await readFile(DATA_PATH, "utf8")) as ViewData;
    if (!parsed?.views || typeof parsed.views !== "object") {
      throw new Error("views 不是物件");
    }

    cache = { mtimeMs, data: parsed };
    return parsed;
  } catch (error) {
    // 檔案還不存在 = 還沒有人看過，不是錯誤。
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error(`[views] 讀取 ${DATA_PATH} 失敗：`, error);
    }
    cache = null;
    return EMPTY;
  }
}

// 所有寫入排在同一條 promise chain 上，讀-改-寫之間不會有人插隊。
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  // 讓失敗的一次寫入不會毒死整條鏈。
  queue = next.catch(() => {});
  return next;
}

// 記一次瀏覽。呼叫點只有個人頁的 render（見 src/app/page.tsx）。
export async function recordView(email: string): Promise<void> {
  return serialize(async () => {
    const key = email.trim().toLowerCase();
    const now = new Date().toISOString();

    const { views } = await load();
    const prev = views[key];

    const next: ViewData = {
      views: {
        ...views,
        [key]: {
          count: (prev?.count ?? 0) + 1,
          firstAt: prev?.firstAt ?? now,
          lastAt: now,
        },
      },
    };

    // 先寫 .tmp 再 rename：rename 在同一個檔案系統上是原子的，
    // 中途斷電不會讓下一次讀到半份 JSON。同 reveals.ts。
    await writeFile(TMP_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
    await rename(TMP_PATH, DATA_PATH);
    cache = null;
  });
}

// admin 頁專用：目前全部的瀏覽紀錄，key 一律小寫 email。
export async function allViews(): Promise<Record<string, ViewStat>> {
  const { views } = await load();
  return views;
}
