// 大螢幕拿到的那包資料。形狀由 /api/stage/<token>/board 決定。
//
// 刻意用自己的一份型別、不直接吃 @/lib/standings 的：那支透過 pairs.ts 拉了
// server-only，client component 用 type-only import 才安全。與其到處小心，
// 不如在這裡把「大螢幕看得到什麼」寫成一份獨立的契約——順便也就是個資邊界的清單：
// 徽記、學長姐與學弟妹姓名、秒數，**沒有信箱、沒有 seniorKey、沒有登記方式**。
//
// 一隊 = 一位學長姐（帶 2 位學弟妹的也只有一隊），所以 juniorNames 是陣列。
export interface StageTeam {
  badge: { emoji: string; name: string };
  seniorName: string;
  juniorNames: string[];
}

export interface StageStanding extends StageTeam {
  rank: number;
  ms: number;
}

export interface StageData {
  phase: "idle" | "racing" | "ended";
  round: number;
  startedAt: string | null;
  endedAt: string | null;
  serverNow: string;
  total: number;
  standings: StageStanding[];
  unfinished: StageTeam[];
}
