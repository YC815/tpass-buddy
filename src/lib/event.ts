// 活動狀態的唯一真相：直屬公布與否、比賽在哪個階段、本場的碼與完賽紀錄。
//
// 形狀刻意對照 src/lib/reveals.ts：一樣是 server-only + runtime fs 讀檔（不是 import），
// 一樣放在 gitignored 的 data/ 底下，一樣是 mtime 快取 + 單一 promise chain 序列化 +
// .tmp → rename 原子換檔。理由同 reveals.ts：pm2 fork mode / instances:1，全站單一 process。
//
// 為什麼公布（publicReveal）與比賽（phase）是兩個正交欄位：
//   它們是兩件事。平日「直接公布」不代表在比賽；比賽當天也不必把直屬藏回去
//   （純速度賽——大家早就知道對方是誰，比的是誰先在人群裡找到人並掃碼）。
//   萬一臨時想改回「蓋牌現場相認」，把 publicReveal 切 false 就回到舊行為，程式碼一行不用改。
//
// 為什麼 finishes 不清空：只靠 round 過濾。重置比賽零資料遺失，出事還查得回來。
//
// ⚠️ scripts/push-data.mjs 只送 pairs.json / profiles.json，所以主機上這個檔
//    不會被本機的版本蓋掉——線上狀態是線上自己的。
import "server-only";
import { randomInt } from "node:crypto";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type Phase = "idle" | "racing" | "ended";

export interface Finish {
  junior: string; // email
  senior: string; // email
  at: string; // ISO 8601
  round: number;
  by: "scan" | "admin"; // 手動補登要留痕（有人手機沒電／沒網路）
}

export interface EventState {
  publicReveal: boolean;
  phase: Phase;
  round: number; // 0 = 還沒比過任何一場
  startedAt: string | null; // 鳴槍
  endedAt: string | null; // 收場
  codes: Record<string, string>; // email → 本場六位碼；空的就退回 pairs.json 的碼
  finishes: Finish[];
}

// 靜態路徑，理由同 pairs.ts：Turbopack 的檔案追蹤看得懂這個形式。
const DATA_PATH = path.join(process.cwd(), "data", "event.json");
const TMP_PATH = `${DATA_PATH}.tmp`;

// 檔案不存在＝還沒有人動過後台。預設就是「直接公布、沒在比賽」，
// 也就是平日該有的樣子——第一次部署不必手動建檔。
const DEFAULT: EventState = {
  publicReveal: true,
  phase: "idle",
  round: 0,
  startedAt: null,
  endedAt: null,
  codes: {},
  finishes: [],
};

let cache: { mtimeMs: number; data: EventState } | null = null;

// 讀進來的東西可能是舊版寫的、也可能被人手改壞。逐欄位補值，
// 壞一個欄位不該讓整個活動當掉（比賽當天沒有 debug 的時間）。
function normalize(raw: unknown): EventState {
  const it = (raw ?? {}) as Partial<EventState>;
  const phase: Phase =
    it.phase === "racing" || it.phase === "ended" ? it.phase : "idle";
  return {
    publicReveal: it.publicReveal !== false,
    phase,
    round: Number.isInteger(it.round) ? (it.round as number) : 0,
    startedAt: typeof it.startedAt === "string" ? it.startedAt : null,
    endedAt: typeof it.endedAt === "string" ? it.endedAt : null,
    codes:
      it.codes && typeof it.codes === "object" ? (it.codes as Record<string, string>) : {},
    finishes: Array.isArray(it.finishes) ? it.finishes : [],
  };
}

export async function eventState(): Promise<EventState> {
  try {
    const { mtimeMs } = await stat(DATA_PATH);
    if (cache?.mtimeMs === mtimeMs) return cache.data;

    const data = normalize(JSON.parse(await readFile(DATA_PATH, "utf8")));
    cache = { mtimeMs, data };
    return data;
  } catch (error) {
    // 檔案還不存在 = 還沒動過後台，不是錯誤。
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error(`[event] 讀取 ${DATA_PATH} 失敗：`, error);
    }
    cache = null;
    return DEFAULT;
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

// fn 原封不動回傳同一個 state 就代表「這次不必改」，直接跳過寫檔。
// 兩個常見情況都靠這一條擋掉，不必在每個呼叫端各判斷一次：
//   · 平日每一次掃碼都會呼叫 recordFinish，但沒在比賽
//   · 兩個人同時互掃，第二次是重複登記
// 白寫一次不只浪費 IO，還會把 mtime 快取打掉、害下一個請求重讀檔案。
async function mutate(
  fn: (state: EventState) => EventState,
): Promise<EventState> {
  return serialize(async () => {
    const current = await eventState();
    const draft = fn(current);
    if (draft === current) return current;

    const next = normalize(draft);

    // 先寫 .tmp 再 rename：rename 在同一個檔案系統上是原子的，
    // 中途斷電不會讓下一次讀到半份 JSON。同 reveals.ts / views.ts。
    await writeFile(TMP_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
    await rename(TMP_PATH, DATA_PATH);
    cache = null;
    return next;
  });
}

// ── 直屬公布 ──────────────────────────────────────────────────────────
export async function setPublicReveal(publicReveal: boolean): Promise<EventState> {
  return mutate((state) => ({ ...state, publicReveal }));
}

// ── 本場的六位碼 ──────────────────────────────────────────────────────
//
// ★ 為什麼每場要重擲 ★
// 大家已經知道直屬是誰，碼又固定顯示在自己螢幕上——賽前兩個人站在一起互相截圖，
// 鳴槍瞬間手打就能 0.5 秒完賽。所以鳴槍時整批重新產生，賽前截的圖一律失效。
//
// 為什麼不改 scripts/sync-pairs.mjs：那支的鐵律是「re-sync 一律沿用舊值」，
// 重擲會讓活動中的人全部對不上。本場碼獨立存在這裡，pairs.json 一個字不動。
//
// 為什麼不用 hash(email + round)：94 個人塞六位數空間，生日碰撞率約 0.4%，
// 不能忽略。照 sync-pairs.mjs 的做法用「碰撞就重擲」的迴圈，保證整批唯一。
function rollCodes(emails: string[]): Record<string, string> {
  const taken = new Set<string>();
  const codes: Record<string, string> = {};
  for (const email of emails) {
    const key = email.toLowerCase();
    if (codes[key]) continue; // 帶 2 位學弟妹的學長姐會出現兩次，但只該有一組碼
    for (;;) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      if (taken.has(code)) continue;
      taken.add(code);
      codes[key] = code;
      break;
    }
  }
  return codes;
}

// 這個人這一場的碼。還沒比過任何一場（codes 是空的）就退回 pairs.json 的原碼，
// 所以平日的 QR 與現在完全一樣。
export function codeOf(
  state: EventState,
  email: string,
  fallback: string,
): string {
  return state.codes[email.toLowerCase()] ?? fallback;
}

// ── 比賽階段 ──────────────────────────────────────────────────────────

// 鳴槍。round++ 並重擲全場的碼，所以這一顆按鈕同時就是「重置」——
// 上一場的完賽紀錄留在 finishes 裡但 round 不同，排名不會被污染。
export async function startRace(emails: string[]): Promise<EventState> {
  return mutate((state) => ({
    ...state,
    phase: "racing",
    round: state.round + 1,
    startedAt: new Date().toISOString(),
    endedAt: null,
    codes: rollCodes(emails),
  }));
}

// 收場。主持人手動按——有人請假整隊湊不齊，不能靠時間自動結束。
export async function stopRace(): Promise<EventState> {
  return mutate((state) => ({
    ...state,
    phase: "ended",
    endedAt: state.endedAt ?? new Date().toISOString(),
  }));
}

// 回到待命（比賽紀錄仍在，只是不再顯示比賽畫面）。
export async function resetRace(): Promise<EventState> {
  return mutate((state) => ({
    ...state,
    phase: "idle",
    startedAt: null,
    endedAt: null,
  }));
}

// 登記一隊完賽。冪等——兩個人同時互掃是正常操作，第二次不該改成績。
// 只在比賽進行中受理：收場後掃到的不算，待命時掃到的也不算。
export async function recordFinish(
  juniorEmail: string,
  seniorEmail: string,
  by: Finish["by"],
): Promise<void> {
  const junior = juniorEmail.toLowerCase();
  const senior = seniorEmail.toLowerCase();

  await mutate((state) => {
    // 回傳原本的 state ＝ 不寫檔（見 mutate）。平日的掃碼與重複登記都走這兩條。
    if (state.phase !== "racing") return state;

    const done = state.finishes.some(
      (f) =>
        f.round === state.round && f.junior === junior && f.senior === senior,
    );
    if (done) return state;

    return {
      ...state,
      finishes: [
        ...state.finishes,
        { junior, senior, at: new Date().toISOString(), round: state.round, by },
      ],
    };
  });
}
