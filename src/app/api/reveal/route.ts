// 相認端點：現場掃到對方 QR（或手打對方的碼）之後打這裡。
//
// ★ 安全核心 ★
// 收到的 code 只是一個指標，本身不帶身分。掃描者是誰**一律取自 session 的 JWT**，
// 絕不信任 client 送來的任何身分欄位。伺服器自己去查「這個碼的持有人，是不是
// 這位登入者的配對對象」——是才登記並回資料，不是就一律回同一句「這不是你的直屬」。
//
// 所以 QR 被截圖亂傳也沒有意義：拿到別人的碼，除非你正好是他的直屬，否則什麼都問不出來。
import { NextResponse } from "next/server";
import { tpass } from "@/config/auth";
import { lookupByEmail, otherOf } from "@/lib/pairs";
import { codeOf, eventState, recordFinish } from "@/lib/event";
import { recordReveal } from "@/lib/reveals";

export const dynamic = "force-dynamic";

// 暴力試碼的門檻。六位數字有 100 萬組，10 次/分鐘要 69 天才掃得完一輪。
// 單一 process（pm2 fork mode）所以一個 Map 就夠；重啟清空，活動場景可接受。
const LIMIT = 10;
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(email: string): boolean {
  const now = Date.now();
  const recent = (hits.get(email) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(email, recent);
  return recent.length > LIMIT;
}

export async function POST(request: Request) {
  const session = await tpass.getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (rateLimited(session.email)) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  const lookup = await lookupByEmail(session.email);
  if (!lookup) {
    return NextResponse.json({ error: "not_in_roster" }, { status: 403 });
  }

  // 只在「自己名下的配對」裡找這個碼。別人的碼在這裡永遠對不上。
  //
  // 比對的是「本場的碼」：每次鳴槍都會整批重擲（見 src/lib/event.ts 的 rollCodes），
  // 所以賽前互相截圖對方螢幕、鳴槍瞬間手打送出的那套玩法會直接失效。
  // 還沒比過任何一場時退回 pairs.json 的原碼，平日行為完全不變。
  const state = await eventState();
  const matched = lookup.pairs.find((pair) => {
    const other = otherOf(pair, lookup.role);
    return codeOf(state, other.email, other.code) === code;
  });
  if (!matched) {
    return NextResponse.json({ error: "not_your_buddy" }, { status: 404 });
  }

  // 冪等：兩個人同時互掃是正常操作，第二次不該報錯。
  await recordReveal(matched.junior.email, matched.senior.email);

  // 比賽進行中才計分。recordFinish 自己會擋掉非 racing 的階段與重複登記，
  // 所以這裡無條件呼叫，不必在兩個地方各判斷一次。
  await recordFinish(matched.junior.email, matched.senior.email, "scan");

  const person = otherOf(matched, lookup.role);
  return NextResponse.json({
    badge: matched.badge,
    person: { name: person.name, email: person.email, grade: person.grade },
  });
}
