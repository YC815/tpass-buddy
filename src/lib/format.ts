// 兩邊都要用的純格式化。
//
// ⚠️ 這支刻意**不**寫 `import "server-only"`：個人頁的計時器、後台的排行榜、
// 大螢幕的成績都是 client component，它們要顯示秒數。放進 standings.ts 的話
// 會透過 pairs.ts 把 server-only 拉進 client bundle，build 直接失敗。

// 「2:34.7」。全站共用同一個格式，不要各寫各的——
// 大螢幕唸出來的秒數必須跟參賽者手機上看到的一模一樣。
export function formatMs(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
