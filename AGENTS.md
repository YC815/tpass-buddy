# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# tpass-buddy（T-Buddy 直屬配對）

登入後查自己的直屬；`/roster/<token>` 是給內部人士的免登入總表；`/stage/<同一個 token>` 是
活動當天的投影大螢幕；`/admin` 是主持人控制台＋瀏覽計次（role=admin）。
**115 直屬活動限定的臨時服務**，活動結束整個撤掉（撤下步驟見 `README.md`）。
生態系總覽、`services.json` 註冊表與 `tpass` CLI 見上層 **tpass-ops** repo（`AGENTS.md`、`docs/`）。

## 鐵律

- 本機跑 `pnpm dev`（已設好 HTTPS + `buddy.lvh.me:3008` + `NODE_TLS_REJECT_UNAUTHORIZED=0`；憑證在 `$HOME/tpass-certs`）。檢查用 `pnpm lint` + `pnpm exec tsc --noEmit`。
- UI 一律 light-only Neobrutalism + OKLCH，照 `tpass-portal/docs/design.md`。
- SSO 驗章在**套件 `tpass-auth-js`**（契約 v2，2026-08-27 起）——本 repo 只在 `src/config/auth.ts` 綁 env，callback / logout 兩條 route 各一行。四鐵則（EdDSA 鎖定 / issuer / audience=tpass:buddy / exp）在套件裡且有測試守著；要改就去 `github.com/tschoolsu/tpass-auth-js` 改，**不要在這裡復活一份手抄的 `src/lib/tpass-auth.ts`**。只碰公鑰，絕不 import auth 的私鑰。
- 網域 / issuer / audience 全 env 驅動（`src/config/auth.ts`），不寫死。
- **`data/` 是完整個資，這個 repo 是 public。** 任何情況都不要 `git add data/`、不要把姓名或信箱貼進 commit / log / issue。資料只經 `pnpm sync`（Excel → JSON）與 `pnpm push:data`（ssh 上機）流動。
- **總表頁不得碰 `Person.email`。** `rosterBySenior()` 回的是 `PublicPerson`（沒有 email 欄位）——這是型別層的保證，不要為了當 React key 之類的理由把 email 加回去：傳進 JSX 的值會序列化進 RSC payload，在 HTML 原始碼裡看得到。
- `src/lib/pairs.ts` 用 **runtime `fs.readFile`**，不是 `import`。改成 import 會把資料烤進 build，換表格就得重新部署。路徑靜態寫死在 `data/` 底下，別改成 env 可指定（Turbopack 會把整個專案追蹤進 NFT）。
- 四個資料頁都必須維持 `export const dynamic = "force-dynamic"`，否則靜態化後換檔案不生效。
  個人頁 `/` 還多一層理由：它的 render 就是 `/admin` 的計次點。同理，指向 `/` 的 `<Link>`
  一律 `prefetch={false}`，否則預取會替沒點的人計一次。
- 沒有資料庫、沒有 Prisma（registry `db: null`）。不要為了「正規」而加。
  活動狀態（公布開關／比賽階段／本場的碼／完賽紀錄）全在 `data/event.json`，
  持久層是 `src/lib/event.ts`——與 `reveals.ts` / `views.ts` 同一套（mtime 快取 +
  單一 promise chain 序列化 + `.tmp`→`rename`）。要加新的可變狀態就照抄那個形狀。
- **鳴槍會重擲全場的六位碼**（`event.json.codes`），這是防作弊的核心，不要為了「簡單」
  拿掉。`pairs.json` 的 `code` 只是 fallback，`sync-pairs.mjs` 一個字都不用改。
  取碼一律走 `codeOf(state, email, fallback)`，不要直接讀 `person.code`。
- **`src/lib/format.ts` 不加 `server-only`**：`formatMs` 是 client component 要用的。
  不要把它搬回 `standings.ts`——那支透過 `pairs.ts` 拉了 server-only，搬回去 build 會炸。
- **計分看「隊」，相認看「對」——兩個單位不一樣，不要混用**：
  計分的單位是學長姐（帶 2 位學弟妹的只算一隊，取最早找到的那一位，47 對 → 45 隊）；
  相認的單位仍然是一對一對，第二位學弟妹**還是要掃**，只是那一掃不計分。
  兩者都在 `src/lib/standings.ts`：`boardOf()`（按 `seniorKeyOf` 分組）算名次、
  `finishedPairKeys()`（按 `pairKeyOf`）算還有誰沒相認。個人頁 / 後台 / 大螢幕都問它——
  不要在任何一邊自己數 `pairs.length` 當隊數，也不要自己算名次。
  要問「我是哪一隊」用 `teamKeyOf(lookup.pairs)`。
  個人頁的掃描區開關看的是 `pending`（對），不是 `finish`（隊）——寫反了會讓
  第二位學弟妹連掃都掃不了。
- **`/stage` 送出去的東西是投影出來的**：只有徽記、學長姐與學弟妹姓名、秒數。
  `seniorKey`（含信箱）與 `by`（是不是手動補登）由 `publicStandings()` / `publicTeams()`
  在型別層剝掉，不要為了「順便」把它們加回去。
- React Compiler 開著（`reactCompiler: true`）：render 期間不可呼叫 `Date.now()`、
  不可讀 ref、effect 裡不可同步 `setState`。時鐘一律用 `useServerClock()`
  （也順便解掉 SSR hydration 不一致與使用者裝置時鐘沒對時的問題）。
- 大螢幕的動畫在 `globals.css` 的 `.anim-*`，全部有 `prefers-reduced-motion` 退場。
  發光效果不准用 soft shadow——`glow-hard` 是讓 hard shadow 換色，這是 Neobrutalism 的底線。
