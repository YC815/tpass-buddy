# T-Buddy — 新生直屬配對查詢

115 學年度直屬活動限定的**臨時服務**。活動結束就撤下（見最後一節）。

三個入口，觀眾不同：

| 路徑 | 誰能看 | 看到什麼 |
| --- | --- | --- |
| `/` | 全校師生（tpass SSO 登入） | **只有自己那一組**：相認前是徽記，相認後才有對方姓名、年級、信箱 |
| `/roster/<BUDDY_ROSTER_TOKEN>` | 知道路徑的人（免登入） | **總表**：學長姐分組卡片 + 姓名搜尋，不含信箱 |
| `/admin` | buddy 的 role=admin | **瀏覽狀況**：名單上每個人看過幾次、最後一次何時、相認了幾組 |

沒有資料庫。配對資料、相認紀錄、瀏覽計次各是一份 JSON 檔（`data/`，不進 git）。

---

## 相認遊戲（活動當天）

個人頁預設**不顯示對方是誰**，只顯示你們這一組的動物徽記（🦩 火鶴）。到現場找到
同樣徽記的人，其中一人掃另一人的 QR（或手打對方螢幕上的六位數碼），伺服器登記
這一對已相認，兩邊的卡片才翻開。之後再開網頁就直接顯示，不用再相認一次。

- **徽記**屬於「一對」（帶 2 位學弟妹的學長姐有 2 枚），**配對碼**屬於「一個人」。
  兩者都由 `pnpm sync` 產生，寫在 `data/pairs.json` 裡。
- **QR 裡編的就是那組六位數碼**，沒有姓名也沒有信箱。掃描者身分一律取自 JWT，
  伺服器自己判斷「這個碼的持有人是不是你的配對對象」——不是就一律回同一句話。
  所以 QR 被截圖亂傳沒有意義。試碼有 10 次/分鐘的上限。
- 相認紀錄寫在 `data/reveals.json`（先寫 `.tmp` 再 `rename`）。pm2 是 fork mode /
  instances:1，單一 process，所以不需要資料庫也不會有併發問題。
- 對方掃了你之後，你這邊每 3 秒輪詢一次自己翻開，不必手動重整。

### 兩顆開關（`.env.local`）

| env | 作用 |
| --- | --- |
| `BUDDY_REVEAL_AT` | ISO 8601 時間。過了就**所有人**直接看到對方資訊，不必相認。沒到場、沒相認到的人靠這個兜底。留空 = 沒有兜底時間。 |
| `BUDDY_FORCE_REVEAL` | `true` 全開（不管時間）、`false` 強制鎖（即使過了時間仍只能靠相認）、留空 = 看上面那顆。 |

判斷邏輯只有 `src/lib/reveal-policy.ts` 一支，page 與兩支 API 都問它。

---

## 瀏覽狀況（`/admin`）

想知道「誰還沒點進來看自己的直屬」就開這頁。

- **誰進得去**：JWT 的 `permissions.buddy.role === "admin"`。名單在 **auth 的 `/admin` panel** 管，
  本服務不自維護 allowlist、不吃 env。非 admin 一律 404（不透露這頁存在，同總表的中性 404）。
- **計次點**：個人頁 `/` 每 render 一次就 +1，寫進 `data/views.json`（同 `reveals.json` 的
  單 process 序列化 + `.tmp` → `rename` 模式）。跟有沒有相認、有沒有看到對方是誰無關。
  Header 的 Logo `<Link href="/">` 因此設了 `prefetch={false}`——自動預取會在使用者沒點的
  情況下幫他計一次。
- **名單以 `pairs.json` 為準**：沒進來過的人才會顯示成「未看」。不在配對表上的人（老師、
  好奇的其他學生）就算進過首頁也不會出現在這頁。
- **計次從功能上線那一刻起算**，之前的瀏覽沒有回溯資料。

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

> ⚠️ **活動開始後，只能在有本機 `data/pairs.json` 的那台機器上重跑 `sync`。**
> 徽記與配對碼是靠「讀舊檔沿用舊值」保持穩定的；在沒有舊檔的機器上重跑會整批重擲，
> 所有人的徽記與碼當場失效，已經相認的人也對不上。
> （`sync` 只動 `pairs.json`，不會碰 `reveals.json` / `views.json`。）

`pnpm push:data` 走 `../scripts/ssh.sh`（ops repo），先寫 `.tmp` 再 `mv`，中途斷線不會讓線上讀到半份 JSON。
遠端路徑從 `tpass-registry/services.json` 推導，主機位址只存在 ops 層 gitignored 的 `deploy/host.env`。

### 個人留言與 IG（`data/profiles.json`）

想讓某個人在被揭曉時多顯示一句話 / 一個 IG，就手寫這份檔案（沒有這個檔＝沒有人留言）：

```json
{
  "11400000@tschool.tp.edu.tw": {
    "instagram": "someone",
    "note": "很高興成為你的直屬！"
  }
}
```

兩個欄位都顯示在牌組下方的**同一張留言卡**上：`note` 是內文，`instagram` 是底下那顆
連到 `instagram.com/<帳號>` 的按鈕。翻牌卡本身不動——那張卡是「你的直屬是誰」，
IG 是「他想對你說的話」的一部分，不是聯絡資訊欄位（而且段落塞進 22rem 的卡會爆版）。
只填一個欄位也成立。兩者都**只在這一對相認之後**才會離開伺服器
——跟姓名信箱走同一道門（`src/app/page.tsx` 的個資邊界）。

這份是人手維護的，`pnpm sync` 不會碰它（所以不會被 Excel 重生蓋掉）；
`pnpm push:data` 有這個檔就一起送上主機，換檔案 → 重整頁面即生效。

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
4. 主機：`rm -rf /home/service/tpass-buddy`（**含 `data/pairs.json` 與 `data/reveals.json`，個資一併清掉**）
5. Cloudflare 刪掉 `buddy` 的 A record；請 root 移除 nginx server block
