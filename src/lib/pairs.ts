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
  // 相認用的六位數字碼。屬於「一個人」，QR 裡編的就是它。
  // 由 scripts/sync-pairs.mjs 產生並在 re-sync 時沿用。
  code: string;
}

// 活動當天兩個人在人群裡認出彼此的記號。屬於「一對」，不是屬於人——
// 帶 2 位學弟妹的學長姐會有 2 枚徽記，各自對應一位學弟妹。
export interface BadgeMark {
  emoji: string;
  name: string;
}

export interface Pair {
  junior: Person;
  senior: Person;
  badge: BadgeMark;
}

export interface PairData {
  version: string;
  syncedAt: string;
  pairs: Pair[];
}

// 總表頁專用：剝掉信箱只留渲染用得到的欄位。
// 光是「不顯示」還不夠——傳進 JSX 的值（連 key 也算）會被序列化進 RSC payload，
// 在 HTML 原始碼裡看得到。要它不外流，就不能讓它進到這一層。
//
// code 也一定要剝掉：總表列出全部 90 個人，附上碼就等於把整場遊戲的鑰匙
// 印在同一頁上——拿得到總表連結的人可以照著暴力試出自己的直屬。
export type PublicPerson = Omit<Person, "email" | "code">;

export interface SeniorGroup {
  senior: PublicPerson;
  juniors: PublicPerson[];
}

// 登入者在這份表上的身分與他名下的配對。
// 統一回「一疊 pair」而不是分成 senior / juniors 兩種形狀——配對是遊戲的單位
// （一枚徽記一組碼），上層只要對每個 pair 做同一件事，不必分岔。
export type Role = "junior" | "senior";

export interface Lookup {
  role: Role;
  pairs: Pair[];
}

// 從一組配對裡取出「對方」。登入者是新生就是學長姐，反之亦然。
export function otherOf(pair: Pair, role: Role): Person {
  return role === "junior" ? pair.senior : pair.junior;
}

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

// 用登入者的信箱找出他名下的配對。找不到回 null（老師、未參與者都走這條）。
export async function lookupByEmail(email: string): Promise<Lookup | null> {
  const target = normalize(email);
  const { pairs } = await loadPairs();

  const asJunior = pairs.filter((p) => normalize(p.junior.email) === target);
  if (asJunior.length > 0) return { role: "junior", pairs: asJunior };

  const asSenior = pairs.filter((p) => normalize(p.senior.email) === target);
  if (asSenior.length > 0) return { role: "senior", pairs: asSenior };

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

// admin 頁用：名單上的每一個人一列（學長姐帶 2 位學弟妹也只有一列）。
// 這裡刻意帶 email——它是跟 views.json / reveals.json 對照的鍵，
// 不像總表頁那樣是要送進 client 的資料。
export interface Participant {
  name: string;
  email: string; // 已 normalize（小寫）
  grade: string;
  role: Role;
  // 名下的配對，用來算「相認了幾組」。
  pairs: Pair[];
}

export async function participants(): Promise<Participant[]> {
  const { pairs } = await loadPairs();
  const people = new Map<string, Participant>();

  const add = (person: Person, role: Role, pair: Pair) => {
    const key = normalize(person.email);
    const entry = people.get(key) ?? {
      name: person.name,
      email: key,
      grade: person.grade,
      role,
      pairs: [],
    };
    entry.pairs.push(pair);
    people.set(key, entry);
  };

  for (const pair of pairs) {
    add(pair.junior, "junior", pair);
    add(pair.senior, "senior", pair);
  }

  return [...people.values()].sort(
    (a, b) =>
      gradeRank(a.grade) - gradeRank(b.grade) || byName(a.name, b.name),
  );
}
