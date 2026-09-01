"use client";

// 早退名單：活動當天籌備把「請假的人的直屬」勾起來，湊成一份可以先離場的名單。
//
// 資料只活在這台瀏覽器的 localStorage——這是一次性的現場工具，不值得開持久層，
// 也不該把「誰請假」這種資訊送回主機留下紀錄。清空按鈕一按就沒了。
//
// 用 useSyncExternalStore 而不是 useEffect + setState：React Compiler 開著，
// effect 裡同步 setState 會被 lint 擋；而且這樣 SSR 與 hydration 都拿到同一份空陣列，
// 不會閃一下。
import { useCallback, useSyncExternalStore } from "react";

export interface Pick {
  name: string;
  grade: string;
}

// 總表沒有信箱（見 pairs.ts 的 PublicPerson），只能拿年級＋姓名當識別。
// 同年級同名的機率在 90 人裡可以忽略。
export const pickKey = (p: Pick) => `${p.grade}|${p.name}`;

const STORAGE_KEY = "tpass-buddy:leave-list:v1";
const EMPTY: Pick[] = [];

const listeners = new Set<() => void>();

// getSnapshot 每次 render 都會被呼叫，回傳值必須引用穩定，否則 React 會無限重渲。
// 拿 localStorage 的原始字串當快取鍵：字串沒變就回同一個陣列。
let cachedRaw: string | null = null;
let cachedList: Pick[] = EMPTY;

const isPick = (x: unknown): x is Pick =>
  typeof x === "object" &&
  x !== null &&
  typeof (x as Pick).name === "string" &&
  typeof (x as Pick).grade === "string";

function read(): Pick[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 無痕模式／被封鎖的儲存空間：當成空的，功能退化成「只在這一頁有效」。
  }
  if (raw === cachedRaw) return cachedList;

  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed) ? parsed.filter(isPick) : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function write(next: Pick[]) {
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // 寫不進去就只留在記憶體。
  }
  cachedRaw = raw;
  cachedList = next;
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  // 另一個分頁改了名單，這邊跟著更新。
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

export function useLeaveList() {
  const picks = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback((p: Pick) => {
    const key = pickKey(p);
    const current = read();
    write(
      current.some((x) => pickKey(x) === key)
        ? current.filter((x) => pickKey(x) !== key)
        : [...current, p],
    );
  }, []);

  const clear = useCallback(() => write(EMPTY), []);

  return { picks, toggle, clear };
}
