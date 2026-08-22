#!/usr/bin/env node
// 只給本機開發用：把你自己塞進 data/pairs.json，才有得測相認流程。
//
//   pnpm dev:add-me you@tschool.tp.edu.tw            # 你當新生
//   pnpm dev:add-me you@tschool.tp.edu.tw senior     # 你當學長姐（會配 2 位，順便測牌堆）
//
// 加進去的是「測試配對」，對方是假人（@example.invalid），並蓋上 devSeed 記號。
// push-data.mjs 看到那個記號會拒絕上傳——本機玩壞了不會波及主機。
// 想清掉就重跑一次 pnpm sync。
import { readFileSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import path from "node:path";

const OUT = path.resolve("data/pairs.json");
const FAKE_DOMAIN = "@example.invalid";

const die = (msg) => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

const email = (process.argv[2] ?? "").trim().toLowerCase();
const role = (process.argv[3] ?? "junior").trim();

if (!email.includes("@")) die("要給你的登入信箱：pnpm dev:add-me you@tschool.tp.edu.tw [senior]");
if (role !== "junior" && role !== "senior") die(`role 只能是 junior 或 senior，收到「${role}」`);

const data = JSON.parse(readFileSync(OUT, "utf8"));

// 先把舊的測試列清掉，重跑才不會越疊越多。
data.pairs = data.pairs.filter(
  (p) => !p.junior.email.endsWith(FAKE_DOMAIN) && !p.senior.email.endsWith(FAKE_DOMAIN),
);
if (data.pairs.some((p) => p.junior.email === email || p.senior.email === email)) {
  die(`${email} 本來就在名單裡，不需要塞——直接登入就有得測`);
}

const taken = new Set();
for (const p of data.pairs) {
  taken.add(p.junior.code);
  taken.add(p.senior.code);
}
const newCode = () => {
  for (;;) {
    const c = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (!taken.has(c)) {
      taken.add(c);
      return c;
    }
  }
};

const usedEmoji = new Set(data.pairs.map((p) => p.badge.emoji));
const BADGES = [
  { emoji: "🧪", name: "試管" },
  { emoji: "🪀", name: "溜溜球" },
];
const spare = BADGES.filter((b) => !usedEmoji.has(b.emoji));

const me = { name: "我（測試）", email, grade: role === "junior" ? "高一" : "高三", code: newCode() };

// 學長姐版本配 2 位假學弟妹，順便測「兩張卡各自獨立相認」那條路。
const count = role === "senior" ? 2 : 1;
for (let i = 0; i < count; i++) {
  const fake = {
    name: role === "junior" ? `測試學長姐` : `測試學弟妹 ${i + 1}`,
    email: `dev-buddy-${i + 1}${FAKE_DOMAIN}`,
    grade: role === "junior" ? "高三" : "高一",
    code: newCode(),
  };
  data.pairs.push(
    role === "junior"
      ? { junior: me, senior: fake, badge: spare[i], devSeed: true }
      : { junior: fake, senior: me, badge: spare[i], devSeed: true },
  );
}

writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");

const mine = data.pairs.filter((p) => p.devSeed);
console.log(`✅ 已加入測試配對（${role === "junior" ? "你是新生" : "你是學長姐"}）`);
console.log(`   你的碼：${me.code}`);
for (const p of mine) {
  const other = role === "junior" ? p.senior : p.junior;
  console.log(`   ${p.badge.emoji} ${p.badge.name}｜要打的碼：${other.code}（${other.name}）`);
}
console.log(`\n   ⚠️ 這是本機測試資料，push:data 會拒絕上傳。清掉：pnpm sync <xlsx>`);
