#!/usr/bin/env node
// 只給本機開發用：偽造一場比完的比賽，才有得測大螢幕的頒獎動畫。
//
//   pnpm seed:race            # 32 隊完賽、階段停在 ended（可以直接按空白鍵頒獎）
//   pnpm seed:race 12         # 只讓 12 隊完賽
//   pnpm seed:race 20 racing  # 比賽進行中，測即時排行榜那個畫面
//   pnpm seed:race clear      # 清掉，回到待命
//
// 直接寫 data/event.json。**push-data.mjs 不送這個檔**，所以本機怎麼玩都波及不到主機；
// 但這支仍然拒絕在 NODE_ENV=production 下執行，免得有人在主機上手滑。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomInt } from "node:crypto";
import path from "node:path";

if (process.env.NODE_ENV === "production") {
  console.error("❌ 這是本機測試腳本，不在 production 執行。");
  process.exit(1);
}

const PAIRS = path.resolve("data/pairs.json");
const OUT = path.resolve("data/event.json");

if (!existsSync(PAIRS)) {
  console.error("❌ 找不到 data/pairs.json，先跑 pnpm sync。");
  process.exit(1);
}

const { pairs } = JSON.parse(readFileSync(PAIRS, "utf8"));
if (!Array.isArray(pairs) || pairs.length === 0) {
  console.error("❌ pairs.json 裡沒有配對。");
  process.exit(1);
}

const args = process.argv.slice(2);
const clear = args.includes("clear");
const phase = args.includes("racing") ? "racing" : "ended";
const wanted = Number(args.find((a) => /^\d+$/.test(a)) ?? 32);
const count = Math.min(Math.max(0, wanted), pairs.length);

// 既有的檔案要留著 publicReveal（別把使用者切好的開關洗掉）。
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const publicReveal = prev.publicReveal !== false;

if (clear) {
  write({
    publicReveal,
    phase: "idle",
    round: prev.round ?? 0,
    startedAt: null,
    endedAt: null,
    codes: {},
    finishes: [],
  });
  console.log("✅ 已清掉比賽，回到待命。");
  process.exit(0);
}

const round = (prev.round ?? 0) + 1;

// 鳴槍設在 8 分鐘前，成績才有得看。
const gun = Date.now() - 8 * 60_000;

// 隨機挑 count 隊完賽，成績散在 40 秒 ~ 6 分鐘之間。
const shuffled = [...pairs].sort(() => Math.random() - 0.5).slice(0, count);
const finishes = shuffled
  .map((pair) => ({
    junior: pair.junior.email.toLowerCase(),
    senior: pair.senior.email.toLowerCase(),
    at: new Date(gun + randomInt(40_000, 360_000)).toISOString(),
    round,
    // 偶爾來一筆手動補登，順便驗後台那一欄顯示對不對。
    by: Math.random() < 0.1 ? "admin" : "scan",
  }))
  .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

// 本場的碼也一起偽造，不然個人頁的 QR 會退回 pairs.json 的原碼，
// 測不到「鳴槍後碼會變」這件事。
const taken = new Set();
const codes = {};
for (const pair of pairs) {
  for (const person of [pair.junior, pair.senior]) {
    const key = person.email.toLowerCase();
    if (codes[key]) continue;
    let code;
    do {
      code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    } while (taken.has(code));
    taken.add(code);
    codes[key] = code;
  }
}

write({
  publicReveal,
  phase,
  round,
  startedAt: new Date(gun).toISOString(),
  endedAt: phase === "ended" ? new Date().toISOString() : null,
  codes,
  finishes,
});

console.log(
  `✅ 第 ${round} 場・${phase === "ended" ? "已收場" : "進行中"}・${count}/${pairs.length} 隊完賽`,
);
console.log("   大螢幕：https://buddy.lvh.me:3008/stage/<BUDDY_ROSTER_TOKEN>");
if (phase === "ended") console.log("   在那一頁按空白鍵開始頒獎。");

function write(state) {
  writeFileSync(OUT, JSON.stringify(state, null, 2) + "\n", "utf8");
}
