"use client";

import { useState } from "react";
import { Check, ClipboardList, Copy, Trash2, X } from "lucide-react";
import { Button, Card, cn } from "@/components/ui/primitives";
import { pickKey, type Pick } from "@/lib/leave-list";

// 早退名單面板：黏在搜尋列下方，往下捲看卡片時也看得到目前勾了誰。
// 清空要按兩次（第一次變成「確定清空？」），避免現場手滑把整份名單弄丟。

export function LeaveListPanel({
  picks,
  onRemove,
  onClear,
}: {
  picks: Pick[];
  onRemove: (p: Pick) => void;
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const copy = async () => {
    const text = picks.map((p) => p.name).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 沒有 clipboard 權限（http、舊瀏覽器）：退回選取文字讓人自己複製。
      window.prompt("複製底下的名單：", text);
    }
  };

  const clear = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    onClear();
    setConfirming(false);
  };

  return (
    <Card
      className={cn(
        "sticky top-20 z-10 flex flex-col gap-3",
        picks.length > 0 ? "bg-tone-green-bg" : "bg-muted",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <ClipboardList className="size-4" aria-hidden />
          早退名單
          <span className="rounded-md border-2 border-foreground bg-card px-1.5 text-foreground">
            {picks.length}
          </span>
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={copy} disabled={picks.length === 0}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "已複製" : "複製名單"}
          </Button>
          <Button
            size="sm"
            variant={confirming ? "destructive" : "default"}
            onClick={clear}
            disabled={picks.length === 0}
          >
            <Trash2 className="size-4" />
            {confirming ? "確定清空？" : "清空"}
          </Button>
        </div>
      </div>

      {picks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          輸入請假的人的名字，勾選卡片上的直屬對象，名字會收進這裡。名單只存在這台裝置的瀏覽器。
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {picks.map((p) => (
            <li
              key={pickKey(p)}
              className="inline-flex items-center gap-1 rounded-lg border-2 border-foreground bg-card py-0.5 pl-2 pr-1 text-sm font-bold"
            >
              <span className="font-mono text-[11px] text-muted-foreground">{p.grade}</span>
              {p.name}
              <button
                type="button"
                onClick={() => onRemove(p)}
                aria-label={`移除 ${p.name}`}
                className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
