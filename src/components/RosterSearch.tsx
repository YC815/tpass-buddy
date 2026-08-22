"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import type { SeniorGroup } from "@/lib/pairs";

// 總表的搜尋 + 卡片牆。資料只有 90 個名字，全部丟給瀏覽器即時過濾就夠，
// 不需要 debounce、不需要往返伺服器。
//
// 收到的是 SeniorGroup（PublicPerson，沒有 email 欄位）——傳給 client component
// 的東西會完整出現在 HTML 的 RSC payload 裡，所以信箱不能走到這一層。

const norm = (s: string) => s.trim().toLowerCase();

export function RosterSearch({ groups }: { groups: SeniorGroup[] }) {
  const [query, setQuery] = useState("");

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
              <span
                className={
                  hit(group.senior.name)
                    ? "rounded-md bg-tone-orange-badge px-1 text-xl font-extrabold tracking-tight"
                    : "text-xl font-extrabold tracking-tight"
                }
              >
                {group.senior.name}
              </span>
              <Badge className="bg-tone-blue-badge">{group.senior.grade}</Badge>
            </div>
            <ul className="flex flex-col gap-1.5">
              {group.juniors.map((junior, j) => (
                <li key={j} className="flex items-center gap-2 font-semibold">
                  <span aria-hidden className="text-muted-foreground">
                    →
                  </span>
                  <span
                    className={
                      hit(junior.name) ? "rounded-md bg-tone-orange-badge px-1" : undefined
                    }
                  >
                    {junior.name}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
