// 排名計算。純函式——吃 EventState + Pair[]，吐排行榜，不碰檔案也不碰 session，
// 所以個人頁、後台、大螢幕三邊看到的名次保證是同一套算法。
//
// ★ 隊伍的單位是「學長姐」，不是「配對」★
// 帶 2 位學弟妹的學長姐若要兩位都找到才算完賽，等於要跑兩倍的路，不公平。
// 所以一位學長姐＝一隊，成績取**最早找到的那一位學弟妹**的時間。
// 兩位學弟妹都屬於同一隊、共用同一個名次——不然第二位會變成沒有名次的孤兒。
// 47 對配對 → 45 隊（有 2 位學長姐帶 2 位）。
//
// 成績 = 完賽時間 − 鳴槍時間。全場統一鳴槍，所以直接相減就是公平的。
// 未完賽的隊伍不列入排名（沒到場的人罰不到），另外成一張清單給主持人看。
import type { BadgeMark, Pair } from "@/lib/pairs";
import { pairKeyOf, seniorKeyOf } from "@/lib/pairs";
import type { EventState, Finish } from "@/lib/event";

// 大螢幕看得到的欄位。徽記 + 學長姐 + 學弟妹姓名，**沒有信箱**——
// 這份會投影出去，也會整包進 RSC payload，所以個資邊界就在型別這一層。
export interface Team {
  // 代表徽記：完賽的用「計分的那一對」的徽記，未完賽的用名下第一對的。
  badge: BadgeMark;
  seniorName: string;
  // 通常一個；帶 2 位學弟妹的學長姐是兩個，都列出來（他們是同一隊）。
  juniorNames: string[];
}

export interface Standing extends Team {
  rank: number;
  ms: number; // 完賽毫秒
}

// 後台專用的補充欄位。含信箱的 key 絕不能出現在 /stage 那一側
// （剝除由 publicStandings / publicTeams 在型別層保證，同 pairs.ts 的 PublicPerson 用意）。
export interface AdminStanding extends Standing {
  seniorKey: string;
  by: Finish["by"]; // 掃碼還是主持人手動補登
}

// 未完賽的隊伍。手動補登要指定「補登哪一對」，所以把名下每一對都帶上——
// 帶 2 位學弟妹的學長姐會有兩顆按鈕，主持人按實際相認的那一位。
export interface AdminMember {
  pairKey: string;
  juniorName: string;
  badge: BadgeMark;
}

export interface AdminTeam extends Team {
  seniorKey: string;
  members: AdminMember[];
}

export interface AdminBoard {
  total: number; // 隊數（＝學長姐人數）
  standings: AdminStanding[];
  unfinished: AdminTeam[];
}

interface Group {
  seniorKey: string;
  seniorName: string;
  members: AdminMember[];
  // 名下最早完賽的那一對。沒有就是還沒完賽。
  best: { at: number; by: Finish["by"]; member: AdminMember } | null;
}

export function boardOf(state: EventState, pairs: Pair[]): AdminBoard {
  const gun = state.startedAt ? Date.parse(state.startedAt) : NaN;

  // 只認本場（round 相同）的紀錄。上一場的留在檔案裡但不參與排名。
  const finished = new Map<string, { at: number; by: Finish["by"] }>();
  for (const f of state.finishes) {
    if (f.round !== state.round) continue;
    const at = Date.parse(f.at);
    if (Number.isNaN(at)) continue;
    const key = `${f.junior}|${f.senior}`;
    const prev = finished.get(key);
    // 同一對重複登記時取最早的一筆（recordFinish 是冪等的，但手動補登可能疊上去）。
    if (!prev || at < prev.at) {
      finished.set(key, { at, by: f.by === "admin" ? "admin" : "scan" });
    }
  }

  // 依學長姐分組。Map 保留插入順序，所以未完賽清單的順序跟 pairs.json 一致。
  const groups = new Map<string, Group>();
  for (const pair of pairs) {
    const seniorKey = seniorKeyOf(pair);
    const group: Group = groups.get(seniorKey) ?? {
      seniorKey,
      seniorName: pair.senior.name,
      members: [],
      best: null,
    };

    const member: AdminMember = {
      pairKey: pairKeyOf(pair),
      juniorName: pair.junior.name,
      badge: pair.badge,
    };
    group.members.push(member);

    const hit = finished.get(member.pairKey);
    // ★ 就是這一行：一隊只取最早找到的那一位。★
    if (hit && (group.best === null || hit.at < group.best.at)) {
      group.best = { at: hit.at, by: hit.by, member };
    }

    groups.set(seniorKey, group);
  }

  const teamOf = (g: Group): Team => ({
    badge: (g.best?.member ?? g.members[0]).badge,
    seniorName: g.seniorName,
    juniorNames: g.members.map((m) => m.juniorName),
  });

  const done: Array<Group & { best: NonNullable<Group["best"]> }> = [];
  const unfinished: AdminTeam[] = [];

  for (const g of groups.values()) {
    if (g.best) done.push(g as Group & { best: NonNullable<Group["best"]> });
    else
      unfinished.push({
        ...teamOf(g),
        seniorKey: g.seniorKey,
        members: g.members,
      });
  }

  done.sort((a, b) => a.best.at - b.best.at);

  const standings: AdminStanding[] = done.map((g, i) => ({
    ...teamOf(g),
    seniorKey: g.seniorKey,
    by: g.best.by,
    rank: i + 1,
    // 鳴槍時間讀不到（檔案壞了、手動補登在鳴槍前）不該讓整頁爆掉，記 0 就好。
    ms: Number.isNaN(gun) ? 0 : Math.max(0, g.best.at - gun),
  }));

  return { total: groups.size, standings, unfinished };
}

// 這個人屬於哪一隊。個人頁拿它問「我的名次」——學長姐與他名下的
// 每一位學弟妹拿到的是同一隊，所以答案一致。
export function teamKeyOf(pairs: Pair[]): string | null {
  return pairs.length > 0 ? seniorKeyOf(pairs[0]) : null;
}

// 本場已經相認掃到的配對。
//
// ★ 掃碼與計分是兩件事 ★
// 計分的單位是「隊」（一位學長姐，取最早找到的那一位）；相認的單位仍然是「一對」。
// 帶 2 位學弟妹的學長姐找到第一位之後成績就定了，但第二位還是要掃——
// 那一掃只是不計分，不是不用掃。個人頁靠這個 Set 決定還要不要顯示掃描區。
export function finishedPairKeys(state: EventState): Set<string> {
  return new Set(
    state.finishes
      .filter((f) => f.round === state.round)
      .map((f) => `${f.junior}|${f.senior}`),
  );
}

// 送去大螢幕前把 seniorKey（含信箱）與登記方式剝掉。
// 「這隊是主持人手動補登的」是後台才該知道的事，投影出去只會引起爭議。
export function publicStandings(standings: AdminStanding[]): Standing[] {
  return standings.map(({ seniorKey: _k, by: _by, ...rest }) => rest);
}
export function publicTeams(teams: AdminTeam[]): Team[] {
  return teams.map(({ seniorKey: _k, members: _m, ...rest }) => rest);
}
