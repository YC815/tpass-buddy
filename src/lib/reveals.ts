// 「這一對已經在活動現場相認了」的持久層。
//
// 形狀刻意對照 src/lib/pairs.ts：一樣是 server-only + runtime fs 讀檔（不是 import），
// 一樣放在 gitignored 的 data/ 底下，活動結束 rm -rf 就一併消失。
//
// 為什麼一個 JSON 檔就夠、不用 Postgres：
//   deploy/ecosystem.config.js 是 exec_mode: "fork" / instances: 1，全站單一 Node process。
//   所有寫入都經過底下那條 promise chain 序列化，沒有跨 process 競爭的可能。
//   量級是 47 對、活動一小時內寫完，用 DB 只是多請人在主機建 role。
import "server-only";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Reveal {
  junior: string; // email
  senior: string; // email
  at: string; // ISO 8601
}

interface RevealData {
  reveals: Reveal[];
}

// 靜態路徑，理由同 pairs.ts：Turbopack 的檔案追蹤看得懂這個形式。
const DATA_PATH = path.join(process.cwd(), "data", "reveals.json");
const TMP_PATH = `${DATA_PATH}.tmp`;

const EMPTY: RevealData = { reveals: [] };

// mtime 當快取鍵，同 pairs.ts。寫入時會主動失效。
let cache: { mtimeMs: number; data: RevealData } | null = null;

async function load(): Promise<RevealData> {
  try {
    const { mtimeMs } = await stat(DATA_PATH);
    if (cache?.mtimeMs === mtimeMs) return cache.data;

    const parsed = JSON.parse(await readFile(DATA_PATH, "utf8")) as RevealData;
    if (!Array.isArray(parsed?.reveals)) throw new Error("reveals 不是陣列");

    cache = { mtimeMs, data: parsed };
    return parsed;
  } catch (error) {
    // 檔案還不存在 = 還沒有人相認，不是錯誤，也不值得印一行 log。
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error(`[reveals] 讀取 ${DATA_PATH} 失敗：`, error);
    }
    cache = null;
    return EMPTY;
  }
}

// 一對的識別鍵。上層拿它跟 revealedKeys() 的 Set 對照。
export function revealKey(juniorEmail: string, seniorEmail: string): string {
  return `${juniorEmail.toLowerCase()}|${seniorEmail.toLowerCase()}`;
}

// 目前所有已相認的配對，回一個 Set 讓呼叫端一次判斷多組。
export async function revealedKeys(): Promise<Set<string>> {
  const { reveals } = await load();
  return new Set(reveals.map((r) => revealKey(r.junior, r.senior)));
}

// 所有寫入排在同一條 promise chain 上，讀-改-寫之間不會有人插隊。
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  // 讓失敗的一次寫入不會毒死整條鏈。
  queue = next.catch(() => {});
  return next;
}

// 登記一對相認。已經記過就直接回 true（冪等——兩個人同時互掃是正常操作）。
export async function recordReveal(
  juniorEmail: string,
  seniorEmail: string,
): Promise<void> {
  return serialize(async () => {
    const junior = juniorEmail.toLowerCase();
    const senior = seniorEmail.toLowerCase();

    const { reveals } = await load();
    const target = revealKey(junior, senior);
    if (reveals.some((r) => revealKey(r.junior, r.senior) === target)) return;

    const next: RevealData = {
      reveals: [...reveals, { junior, senior, at: new Date().toISOString() }],
    };

    // 先寫 .tmp 再 rename：rename 在同一個檔案系統上是原子的，
    // 中途斷電不會讓下一次讀到半份 JSON。push-data.mjs 也是這個模式。
    await writeFile(TMP_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
    await rename(TMP_PATH, DATA_PATH);
    cache = null;
  });
}
