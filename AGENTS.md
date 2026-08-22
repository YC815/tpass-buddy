# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# tpass-buddy（T-Buddy 直屬配對）

登入後查自己的直屬；`/roster/<token>` 是給內部人士的免登入總表。
**115 直屬活動限定的臨時服務**，活動結束整個撤掉（撤下步驟見 `README.md`）。
生態系總覽、`services.json` 註冊表與 `tpass` CLI 見上層 **tpass-ops** repo（`AGENTS.md`、`docs/`）。

## 鐵律

- 本機跑 `pnpm dev`（已設好 HTTPS + `buddy.lvh.me:3008` + `NODE_TLS_REJECT_UNAUTHORIZED=0`；憑證在 `$HOME/tpass-certs`）。檢查用 `pnpm lint` + `pnpm exec tsc --noEmit`。
- UI 一律 light-only Neobrutalism + OKLCH，照 `tpass-portal/docs/design.md`。
- SSO 驗章照 `src/lib/tpass-auth.ts`（契約 v2），四鐵則（EdDSA 鎖定 / issuer / audience=tpass:buddy / exp）不可動；只碰公鑰，絕不 import auth 的私鑰。
- 網域 / issuer / audience 全 env 驅動（`src/config/auth.ts`），不寫死。
- **`data/` 是完整個資，這個 repo 是 public。** 任何情況都不要 `git add data/`、不要把姓名或信箱貼進 commit / log / issue。資料只經 `pnpm sync`（Excel → JSON）與 `pnpm push:data`（ssh 上機）流動。
- **總表頁不得碰 `Person.email`。** `rosterBySenior()` 回的是 `PublicPerson`（沒有 email 欄位）——這是型別層的保證，不要為了當 React key 之類的理由把 email 加回去：傳進 JSX 的值會序列化進 RSC payload，在 HTML 原始碼裡看得到。
- `src/lib/pairs.ts` 用 **runtime `fs.readFile`**，不是 `import`。改成 import 會把資料烤進 build，換表格就得重新部署。路徑靜態寫死在 `data/` 底下，別改成 env 可指定（Turbopack 會把整個專案追蹤進 NFT）。
- 兩個資料頁都必須維持 `export const dynamic = "force-dynamic"`，否則靜態化後換檔案不生效。
- 沒有資料庫、沒有 Prisma（registry `db: null`）。不要為了「正規」而加。
