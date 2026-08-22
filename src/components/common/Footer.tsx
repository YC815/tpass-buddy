// 頁尾（公版）。與 portal / form 同一份版型：虛線上緣 + logo + 版權。
export function Footer() {
  return (
    <footer className="border-t-2 border-dashed border-foreground/30 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        <span className="font-mono text-sm font-extrabold text-foreground">
          T<span className="text-primary">-</span>Buddy
        </span>
        <span className="font-mono text-xs font-bold text-muted-foreground">
          © 2026 TSchool 學生會數位部
        </span>
      </div>
    </footer>
  );
}
