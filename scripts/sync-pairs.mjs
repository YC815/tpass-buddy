#!/usr/bin/env node
// Excel → data/pairs.json。只在本機跑，產物不進 git、由 push-data.mjs 單獨送上主機。
//
//   pnpm sync "~/Downloads/新生配對結果 v13.xlsx"
//   pnpm sync                # 省略參數 → 讀 data/source.xlsx
//
// 刻意只取「誰對誰」需要的六欄。相似分數與備註不讀——備註含內部討論
// （「不是男生，先改配…」），沒有理由讓它離開你的電腦。
import ExcelJS from "exceljs";
import { readFile, writeFile } from "node:fs/promises";
import { randomInt } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { BADGES } from "./badges.mjs";

const SHEET = "配對結果";
const OUT = path.resolve("data/pairs.json");
const DOMAIN = "@tschool.tp.edu.tw";

// 表頭名稱 → 輸出欄位。改版若動到欄位順序不影響，靠名稱定位。
const COLUMNS = {
  "新生姓名": ["junior", "name"],
  "新生Email": ["junior", "email"],
  "新生年級": ["junior", "grade"],
  "學長姐姓名": ["senior", "name"],
  "學長姐Email": ["senior", "email"],
  "學長姐年級": ["senior", "grade"],
};

const die = (msg) => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

// exceljs 的 cell.value 可能是字串、數字、rich text 物件或 formula 結果。
const toText = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim();
    }
    if ("text" in value) return String(value.text).trim();
    if ("result" in value) return String(value.result).trim();
    return "";
  }
  return String(value).trim();
};

const expandHome = (p) =>
  p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;

const source = path.resolve(expandHome(process.argv[2] ?? "data/source.xlsx"));

const workbook = new ExcelJS.Workbook();
try {
  await workbook.xlsx.readFile(source);
} catch {
  die(`讀不到 Excel：${source}`);
}

const sheet = workbook.getWorksheet(SHEET);
if (!sheet) {
  const names = workbook.worksheets.map((w) => w.name).join("、");
  die(`這個檔案沒有「${SHEET}」分頁（只有：${names}）`);
}

// 找表頭列：不寫死行號，改版時標題可能多一行少一行。
let headerRow = 0;
for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
  const cells = sheet.getRow(r).values.map(toText);
  if (cells.includes("新生姓名")) {
    headerRow = r;
    break;
  }
}
if (!headerRow) die(`「${SHEET}」前 10 列找不到含「新生姓名」的表頭列`);

// 表頭名稱 → 欄號。
const index = {};
sheet.getRow(headerRow).eachCell((cell, col) => {
  const name = toText(cell.value);
  if (name in COLUMNS) index[name] = col;
});
const absent = Object.keys(COLUMNS).filter((k) => !(k in index));
if (absent.length > 0) die(`表頭缺少欄位：${absent.join("、")}`);

// 讀資料列。
const pairs = [];
const problems = [];
for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
  const row = sheet.getRow(r);
  const values = Object.fromEntries(
    Object.entries(index).map(([name, col]) => [name, toText(row.getCell(col).value)]),
  );

  // 整列皆空 = 表格結束（中間的空列也一併跳過，不當成錯誤）。
  if (Object.values(values).every((v) => v === "")) continue;

  const blank = Object.entries(values)
    .filter(([, v]) => v === "")
    .map(([k]) => k);
  if (blank.length > 0) {
    problems.push(`第 ${r} 列：${blank.join("、")} 是空的`);
    continue;
  }

  const pair = { junior: {}, senior: {} };
  for (const [name, [side, field]] of Object.entries(COLUMNS)) {
    pair[side][field] = values[name];
  }

  for (const side of ["junior", "senior"]) {
    const email = pair[side].email.toLowerCase();
    if (!email.endsWith(DOMAIN)) {
      problems.push(`第 ${r} 列：${pair[side].name} 的信箱 ${pair[side].email} 不是 ${DOMAIN}`);
    }
    pair[side].email = email;
  }

  pairs.push(pair);
}

// 交叉檢查：一個新生只能有一位學長姐；同一人不該同時是新生與學長姐。
const juniorEmails = new Set();
const seniorEmails = new Set();
for (const { junior, senior } of pairs) {
  if (juniorEmails.has(junior.email)) {
    problems.push(`新生 ${junior.name}（${junior.email}）出現不只一次`);
  }
  juniorEmails.add(junior.email);
  seniorEmails.add(senior.email);
}
for (const email of juniorEmails) {
  if (seniorEmails.has(email)) problems.push(`${email} 同時是新生和學長姐`);
}

if (pairs.length === 0) problems.push("一組配對都沒讀到");

if (problems.length > 0) {
  console.error(`❌ 資料有問題，沒有寫出任何檔案（${problems.length} 項）：`);
  for (const p of problems) console.error(`   · ${p}`);
  process.exit(1);
}

// ── 徽記與配對碼 ──────────────────────────────────────────────────────
//
// 這兩樣是活動當天的遊戲道具：徽記讓兩個人在人群裡找到彼此（屬於「一對」），
// 配對碼是掃 QR / 手動輸入時的憑據（屬於「一個人」）。
//
// ★ 最重要的規則：re-sync 一律沿用舊值。★
// 活動進行到一半換表格是常有的事，若每次 sync 都重擲，所有人的徽記與碼會
// 當場失效、已經相認的人也對不上。所以先讀舊的 pairs.json，能沿用就沿用，
// 只有「新出現的配對 / 新出現的人」才分配新值。
//
// 代價是：sync 一定要在**有舊 data/pairs.json 的那台機器**上跑。
// 換一台電腦重跑 = 全部重擲。README 有寫這條警告。
const OLD = await readFile(OUT, "utf8").then(JSON.parse).catch(() => null);

const pairKey = ({ junior, senior }) => `${junior.email}|${senior.email}`;

const oldBadges = new Map(); // pairKey → badge
const oldCodes = new Map(); // email → code
for (const pair of OLD?.pairs ?? []) {
  if (pair.badge?.emoji) oldBadges.set(pairKey(pair), pair.badge);
  for (const side of ["junior", "senior"]) {
    if (pair[side]?.code) oldCodes.set(pair[side].email, pair[side].code);
  }
}

if (pairs.length > BADGES.length) {
  die(`徽記不夠：${pairs.length} 組配對，池子裡只有 ${BADGES.length} 個（去 scripts/badges.mjs 加）`);
}

// 沿用的徽記先佔位，剩下的才給新配對用。
const takenEmoji = new Set();
for (const pair of pairs) {
  const kept = oldBadges.get(pairKey(pair));
  if (kept && !takenEmoji.has(kept.emoji)) {
    pair.badge = kept;
    takenEmoji.add(kept.emoji);
  }
}
const spare = BADGES.filter((b) => !takenEmoji.has(b.emoji));
for (const pair of pairs) {
  if (!pair.badge) pair.badge = spare.shift();
}

// 六位數字碼。100 萬組空間裝 90 個人，碰撞重擲即可。
const takenCodes = new Set();
const codeByEmail = new Map();
const newCode = () => {
  for (;;) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (!takenCodes.has(code)) return code;
  }
};
for (const pair of pairs) {
  for (const side of ["junior", "senior"]) {
    const person = pair[side];
    // 帶 2 位學弟妹的學長姐會在兩列各自被讀成一個物件，但他是同一個人，
    // 只能有一組碼——所以認 email 不認物件。
    let code = codeByEmail.get(person.email);
    if (!code) {
      const kept = oldCodes.get(person.email);
      code = kept && !takenCodes.has(kept) ? kept : newCode();
      codeByEmail.set(person.email, code);
      takenCodes.add(code);
    }
    person.code = code;
  }
}

// 版本字串：從 A1 標題抓 v12 這種；抓不到就用檔名，純粹給人在總表頁核對用。
const title = toText(sheet.getRow(1).getCell(1).value);
const version = title.match(/v\d+/)?.[0] ?? path.basename(source);

await writeFile(
  OUT,
  JSON.stringify({ version, syncedAt: new Date().toISOString(), pairs }, null, 2) + "\n",
  "utf8",
);

const bySenior = new Map();
for (const { senior } of pairs) {
  bySenior.set(senior.email, (bySenior.get(senior.email) ?? 0) + 1);
}
const doubles = [...bySenior.values()].filter((n) => n > 1).length;

const freshBadges = pairs.filter((p) => !oldBadges.has(pairKey(p))).length;

console.log(`✅ ${OUT}`);
console.log(`   版本 ${version}｜${pairs.length} 組配對｜${bySenior.size} 位學長姐（其中 ${doubles} 位帶 2 位以上）`);
console.log(
  OLD
    ? `   徽記：沿用 ${pairs.length - freshBadges} 組、新配 ${freshBadges} 組｜配對碼 ${codeByEmail.size} 組`
    : `   徽記：全新分配 ${pairs.length} 組｜配對碼 ${codeByEmail.size} 組（沒有舊 pairs.json 可沿用）`,
);
console.log(`   下一步：pnpm push:data（送上主機，不需要重新部署）`);
