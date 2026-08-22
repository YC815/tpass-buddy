// 配對資料存取層。
//
// 資料不進 git（姓名 + 學校信箱是完整個資，服務 repo 是 public），
// 而是由 scripts/sync-pairs.mjs 從 Excel 產生 data/pairs.json，再單獨送上主機。
//
// 關鍵：這裡用 runtime fs.readFile，**不是 import**。import 會把資料烤進 build，
// 換一次表格就得重新部署；改成 runtime 讀檔後，換檔案 → 重整頁面即生效。
import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface Person {
  name: string;
  email: string;
  grade: string;
}

export interface Pair {
  junior: Person;
  senior: Person;
}

export interface PairData {
  version: string;
  syncedAt: string;
  pairs: Pair[];
}

// 總表頁專用：剝掉信箱只留渲染用得到的欄位。
// 光是「不顯示」還不夠——傳進 JSX 的值（連 key 也算）會被序列化進 RSC payload，
// 在 HTML 原始碼裡看得到。要它不外流，就不能讓它進到這一層。
export type PublicPerson = Omit<Person, "email">;

export interface SeniorGroup {
  senior: PublicPerson;
  juniors: PublicPerson[];
}

export type Lookup =
  | { role: "junior"; senior: Person }
  | { role: "senior"; juniors: Person[] }
  | null;

// 靜態限定在 data/ 底下：Turbopack 的檔案追蹤看得懂這個形式，
// 換成可由 env 指定的路徑會讓它把整個專案都追蹤進去（build 警告）。
const DATA_PATH = path.join(process.cwd(), "data", "pairs.json");

const EMPTY: PairData = { version: "—", syncedAt: "", pairs: [] };

// mtime 當快取鍵：檔案沒換就用記憶體那份，換了下次請求自動重讀。
let cache: { mtimeMs: number; data: PairData } | null = null;

export async function loadPairs(): Promise<PairData> {
  try {
    const { mtimeMs } = await stat(DATA_PATH);
    if (cache?.mtimeMs === mtimeMs) return cache.data;

    const parsed = JSON.parse(await readFile(DATA_PATH, "utf8")) as PairData;
    if (!Array.isArray(parsed?.pairs)) throw new Error("pairs 不是陣列");

    cache = { mtimeMs, data: parsed };
    return parsed;
  } catch (error) {
    // 資料缺失不該讓整站 500——頁面自己會顯示「查無資料」。
    console.error(`[pairs] 讀取 ${DATA_PATH} 失敗：`, error);
    cache = null;
    return EMPTY;
  }
}

const normalize = (email: string) => email.trim().toLowerCase();

// 用登入者的信箱找出他那一組。找不到回 null（老師、未參與者都走這條）。
export async function lookupByEmail(email: string): Promise<Lookup> {
  const target = normalize(email);
  const { pairs } = await loadPairs();

  const asJunior = pairs.find((p) => normalize(p.junior.email) === target);
  if (asJunior) return { role: "junior", senior: asJunior.senior };

  const juniors = pairs
    .filter((p) => normalize(p.senior.email) === target)
    .map((p) => p.junior);
  if (juniors.length > 0) return { role: "senior", juniors };

  return null;
}

// 年級由高到低（學長姐排前面）。表上只會有高一～高三，其餘值排最後。
const GRADE_ORDER = ["高三", "高二", "高一"];
const gradeRank = (grade: string) => {
  const i = GRADE_ORDER.indexOf(grade);
  return i === -1 ? GRADE_ORDER.length : i;
};

const byName = (a: string, b: string) => a.localeCompare(b, "zh-Hant");

const strip = ({ name, grade }: Person): PublicPerson => ({ name, grade });

// 總表用：依學長姐分組，高三在前、同年級按姓名。
export async function rosterBySenior(): Promise<SeniorGroup[]> {
  const { pairs } = await loadPairs();
  const groups = new Map<string, SeniorGroup>();

  for (const { senior, junior } of pairs) {
    const key = normalize(senior.email);
    const group = groups.get(key) ?? { senior: strip(senior), juniors: [] };
    group.juniors.push(strip(junior));
    groups.set(key, group);
  }

  const sorted = [...groups.values()];
  for (const group of sorted) {
    group.juniors.sort((a, b) => byName(a.name, b.name));
  }
  sorted.sort(
    (a, b) =>
      gradeRank(a.senior.grade) - gradeRank(b.senior.grade) ||
      byName(a.senior.name, b.senior.name),
  );
  return sorted;
}
