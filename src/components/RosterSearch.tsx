"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Badge, Card, cn } from "@/components/ui/primitives";
import type { PublicPerson, SeniorGroup } from "@/lib/pairs";
import { pickKey, useLeaveList } from "@/lib/leave-list";
import { LeaveListPanel } from "@/components/LeaveListPanel";

// 總表的搜尋 + 卡片牆。資料只有 90 個名字，全部丟給瀏覽器即時過濾就夠，
// 不需要 debounce、不需要往返伺服器。
//
// 收到的是 SeniorGroup（PublicPerson，沒有 email 欄位）——傳給 client component
// 的東西會完整出現在 HTML 的 RSC payload 裡，所以信箱不能走到這一層。
//
// 每個名字都是一個勾選鈕：活動當天把請假者的名字打進搜尋，卡片留下來，
// 勾對方（學長姐或新生都行），名字進到上方的早退名單（見 lib/leave-list.ts）。

const norm = (s: string) => s.trim().toLowerCase();

function PersonToggle({
  person,
  on,
  hit,
  big,
  onToggle,
}: {
  person: PublicPerson;
  on: boolean;
  hit: boolean;
  big?: boolean;
  onToggle: (p: PublicPerson) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={() => onToggle(person)}
      className={cn(
        "inline-flex min-w-0 items-center gap-2 rounded-lg border-2 px-1.5 py-0.5 text-left transition-colors",
        on ? "border-foreground bg-tone-green-badge" : "border-transparent hover:bg-muted",
        big ? "text-xl font-extrabold tracking-tight" : "font-semibold",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-sm border-2 border-foreground",
          on ? "bg-foreground text-card" : "bg-card",
        )}
      >
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className={cn("truncate", hit && "rounded-md bg-tone-orange-badge px-1")}>
        {person.name}
      </span>
    </button>
  );
}

export function RosterSearch({ groups }: { groups: SeniorGroup[] }) {
  const [query, setQuery] = useState("");
  const { picks, toggle, clear } = useLeaveList();
  const picked = useMemo(() => new Set(picks.map(pickKey)), [picks]);

  const matched = useMemo(() => {
    const q = norm(query);
    if (!q) return groups;
    return groups.filter(
      (g) =>
        norm(g.senior.name).includes(q) ||
        g.juniors.some((j) => norm(j.name).includes(q)),
    );
  }, [groups, query]);

  // 有搜尋時把命中的名字標出來，才知道是誰讓這張卡片留下來的。
  const hit = (name: string) => query.trim() !== "" && norm(name).includes(norm(query));

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋姓名（學長姐或新生都可以）"
          aria-label="搜尋姓名"
          className="w-full rounded-xl border-2 border-foreground bg-card py-3 pl-11 pr-11 font-medium text-foreground shadow-[3px_3px_0_0_var(--color-foreground)] outline-none transition-shadow placeholder:text-muted-foreground/70 focus:shadow-[5px_5px_0_0_var(--color-ring)] [&::-webkit-search-cancel-button]:hidden"
        />
        {query !== "" && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="清除搜尋"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <LeaveListPanel picks={picks} onRemove={toggle} onClear={clear} />

      {query.trim() !== "" && (
        <p className="font-mono text-xs text-muted-foreground">
          {matched.length === 0
            ? `沒有符合「${query}」的人`
            : `${matched.length} 組符合「${query}」`}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matched.map((group, i) => (
          <Card key={i} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 border-b-2 border-foreground pb-2">
              <PersonToggle
                person={group.senior}
                on={picked.has(pickKey(group.senior))}
                hit={hit(group.senior.name)}
                onToggle={toggle}
                big
              />
              <Badge className="shrink-0 bg-tone-blue-badge">{group.senior.grade}</Badge>
            </div>
            <ul className="flex flex-col gap-1">
              {group.juniors.map((junior, j) => (
                <li key={j} className="flex items-center gap-1">
                  <span aria-hidden className="text-muted-foreground">
                    →
                  </span>
                  <PersonToggle
                    person={junior}
                    on={picked.has(pickKey(junior))}
                    hit={hit(junior.name)}
                    onToggle={toggle}
                  />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
