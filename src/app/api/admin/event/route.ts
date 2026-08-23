// 主持人控制台的唯一寫入端點。/admin 頁上的每一顆按鈕都打這裡。
//
// 權限與 /admin 頁同一條：JWT 的 permissions.buddy.role === "admin"
// （名單在 auth 的 /admin panel 管，本服務不自維護 allowlist）。
// guard.ts 的 requireAdmin 用 notFound()，那是給頁面的；route 裡改回 404 JSON，
// 但一樣不說「你不是 admin」——不透露這支端點存在。
import { NextResponse } from "next/server";
import { getSession, permOf } from "@/lib/tpass-auth";
import { loadPairs, pairKeyOf } from "@/lib/pairs";
import {
  recordFinish,
  resetRace,
  setPublicReveal,
  startRace,
  stopRace,
} from "@/lib/event";

export const dynamic = "force-dynamic";

const ACTIONS = [
  "publish",
  "unpublish",
  "start",
  "stop",
  "reset",
  "mark",
] as const;
type Action = (typeof ACTIONS)[number];

const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || permOf(session).role !== "admin") return notFound();

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    pairKey?: unknown;
  } | null;

  const action = body?.action;
  if (typeof action !== "string" || !ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  }

  switch (action as Action) {
    case "publish":
      await setPublicReveal(true);
      break;

    case "unpublish":
      await setPublicReveal(false);
      break;

    case "start": {
      // 鳴槍會重擲全場的碼，所以要先知道名單上有誰。
      const { pairs } = await loadPairs();
      if (pairs.length === 0) {
        return NextResponse.json({ error: "no_roster" }, { status: 409 });
      }
      const emails = pairs.flatMap((p) => [p.junior.email, p.senior.email]);
      await startRace(emails);
      break;
    }

    case "stop":
      await stopRace();
      break;

    case "reset":
      await resetRace();
      break;

    case "mark": {
      // 手動補登（手機沒電／會場沒網路）。只認名單上真的存在的那一對，
      // 不直接採信 client 送來的字串當信箱。
      const pairKey = typeof body?.pairKey === "string" ? body.pairKey : "";
      const { pairs } = await loadPairs();
      const matched = pairs.find((p) => pairKeyOf(p) === pairKey);
      if (!matched) {
        return NextResponse.json({ error: "no_such_pair" }, { status: 404 });
      }
      await recordFinish(matched.junior.email, matched.senior.email, "admin");
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
