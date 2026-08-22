# T-Buddy — 新生直屬配對查詢

115 學年度直屬活動限定的**臨時服務**。活動結束就撤下（見最後一節）。

兩個入口，觀眾不同：

| 路徑 | 誰能看 | 看到什麼 |
| --- | --- | --- |
| `/` | 全校師生（tpass SSO 登入） | **只有自己那一組**：對方姓名、年級、信箱 |
| `/roster/<BUDDY_ROSTER_TOKEN>` | 知道路徑的人（免登入） | **總表**：學長姐分組卡片，不含信箱 |

沒有資料庫、沒有管理介面。配對資料是一份 JSON 檔。

---

## 更新配對表

表格改版時只要兩行，**不需要重新部署**：

```bash
pnpm sync "~/Downloads/新生配對結果 v13.xlsx"   # Excel → data/pairs.json
pnpm push:data                                   # 送上主機
```

`pnpm sync` 讀 `配對結果` 分頁，靠**表頭名稱**定位欄位（不寫死行號，改版動到標題行也不會壞），
只取「誰對誰」需要的六欄——相似分數與備註刻意不讀，那些是內部討論，不該離開你的電腦。
任何一列有問題（信箱不是 `@tschool.tp.edu.tw`、欄位空白、新生重複、同一人既是新生又是學長姐）
就整批中止並印出列號，不會寫出半份檔案。

`pnpm push:data` 走 `../scripts/ssh.sh`（ops repo），先寫 `.tmp` 再 `mv`，中途斷線不會讓線上讀到半份 JSON。
遠端路徑從 `tpass-registry/services.json` 推導，主機位址只存在 ops 層 gitignored 的 `deploy/host.env`。

### 為什麼資料不進 git

47 位學生的姓名 + 學校信箱是完整個資，而**這個 repo 是 public**。
`data/` 整個被 `.gitignore` 排除，`git pull` 也不會碰它，所以資料在歷次部署之間自然存活。

伺服器端是 **runtime 讀檔**（`src/lib/pairs.ts`），不是 `import`——後者會把資料烤進 build，
換一次表格就得重新部署。

---

## 本機開發

```bash
cp .env.example .env.local          # 填值；BUDDY_ROSTER_TOKEN 用 openssl rand -hex 16
pnpm install
pnpm sync "~/Downloads/新生配對結果 v12.xlsx"
pnpm dev                            # https://buddy.lvh.me:3008
```

憑證要涵蓋 `buddy.lvh.me`——`scripts/tpass setup` 會從註冊表重生。

檢查：`pnpm lint` + `pnpm exec tsc --noEmit`。

---

## 串接

契約 v2 的標準消費端，`src/config/auth.ts` / `src/lib/tpass-auth.ts` /
`src/app/api/auth/{callback,logout}` 抄自 `tpass-appeals`，驗章四鐵則照
`tpass-auth/INTEGRATION.md §5`。身分靠 JWT 的 `email` claim 對配對表比對。

總表的 `/roster/<token>` 用單純字串比對：128 bit 的隨機路徑猜不到，
換掉 `BUDDY_ROSTER_TOKEN` 就等於作廢舊連結。整站 `robots: noindex`。

---

## 活動結束後撤下

1. `tpass-registry` 把 `buddy` 的 `enabled` / `deployed` 都改 `false`，merge
2. `tpass deploy auth` + `tpass deploy portal`（大廳卡片與發證白名單同步消失）
3. 主機：`pm2 delete buddy && pm2 save`
4. 主機：`rm -rf /home/service/tpass-buddy`（**含 `data/pairs.json`，個資一併清掉**）
5. Cloudflare 刪掉 `buddy` 的 A record；請 root 移除 nginx server block
