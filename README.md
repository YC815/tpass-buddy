# T-Buddy — 新生直屬配對查詢

115 學年度直屬活動限定的**臨時服務**。活動結束就撤下（見最後一節）。

四個入口，觀眾不同：

| 路徑 | 誰能看 | 看到什麼 |
| --- | --- | --- |
| `/` | 全校師生（tpass SSO 登入） | **只有自己那一組**：直屬是誰；比賽期間多一塊計時器與自己的 QR |
| `/roster/<BUDDY_ROSTER_TOKEN>` | 知道路徑的人（免登入） | **總表**：學長姐分組卡片 + 姓名搜尋，不含信箱 |
| `/stage/<BUDDY_ROSTER_TOKEN>` | 投影電腦（免登入） | **大螢幕**：比賽計時、即時排行、頒獎動畫 |
| `/admin` | buddy 的 role=admin | **主持人控制台**：公布開關、鳴槍收場、即時排行、瀏覽狀況 |

沒有資料庫。配對資料、活動狀態、相認紀錄、瀏覽計次各是一份 JSON 檔（`data/`，不進 git）。

---

## 兩個模式

同一套系統有兩個用法，由 `/admin` 一鍵切換，**即時生效、不必重新部署**。

### 平日：直接公布

進站就看到自己的直屬是誰。這是預設值（`data/event.json` 不存在時就是這個狀態）。

### 活動日：配對競速賽

主持人在 `/admin` 按「鳴槍開始」，全場同一個起跑時間；兩個人在現場找到彼此，
其中一人掃另一人的 QR（或手打六位數碼），那一刻就是完賽時間。
成績 = 完賽時間 − 鳴槍時間。主持人按「收場」結束，然後在 `/stage` 上按空白鍵頒獎。

### ★ 計分看「隊」，相認看「對」★

這是最容易搞混的一條，兩個單位不一樣：

| | 單位 | 規則 |
| --- | --- | --- |
| **計分** | 一位學長姐 = 一隊 | 帶 2 位學弟妹的，成績取**最早找到的那一位** |
| **相認** | 一對配對 | 每一對都還是要掃到，第二位那一掃只是**不計分**，不是不用掃 |

目前 47 對配對 → **45 隊**（有 2 位學長姐帶 2 位學弟妹）。

- 兩位都要找到才算完賽，等於要跑兩倍的路，不公平——所以成績只認第一位。
  兩位學弟妹都屬於同一隊、**共用同一個名次**，不然第二位會變成沒有名次的孤兒。
- 但遊戲本身沒有結束：學長姐找到第一位之後，他與第二位學弟妹的畫面仍然顯示
  QR 與掃描按鈕，另外多一行「還有 N 位直屬沒相認 —— 不再計分，但還是去找他吧」。
- 實作：計分是 `src/lib/standings.ts` 的 `boardOf()`（按 `seniorKeyOf` 分組取最早），
  相認是同一支的 `finishedPairKeys()`（按 `pairKeyOf` 逐對算）。個人頁 / 後台 /
  大螢幕三邊都問這一支，不會各算各的。個人頁的 `race.finish` 是隊伍名次、
  `race.pending` 是還沒相認的對數，**兩個欄位刻意分開**。
- **鳴槍會重擲全場的六位碼與 QR。** 大家已經知道直屬是誰、碼又固定顯示在自己螢幕上，
  不重擲的話兩個人賽前互相截圖、鳴槍瞬間手打就能 0.5 秒完賽。本場的碼存在
  `data/event.json` 的 `codes`，**`data/pairs.json` 一個字不動**（`pnpm sync` 的
  「re-sync 沿用舊值」鐵律因此不受影響）。
- **倒數第一名 = 最後一個完賽的隊伍。** 未完賽的不列入排名——他們多半根本沒到場，罰不到。
  主持人在 `/admin` 另外看得到未完賽名單。
- **手動補登**：有人手機沒電或會場沒網路，主持人在未完賽名單上按「登記完賽」，
  以按下的時間計分（紀錄會標成 `by: "admin"`，但**不會投影到大螢幕上**）。
  帶 2 位學弟妹的學長姐會有兩顆按鈕——按實際相認的那一位。按哪一顆對名次的結果相同
  （反正只取最早的），但紀錄要留對的人。
- **重開一場**：再按一次「鳴槍開始」就是新的一場（`round + 1`、碼再次重擲、排行榜清空）。
  舊紀錄留在 `finishes` 裡靠 `round` 區隔，不會被刪掉。

### 徽記與配對碼

- **徽記**屬於「一對」（帶 2 位學弟妹的學長姐有 2 枚），**配對碼**屬於「一個人」。
  兩者的初始值都由 `pnpm sync` 產生，寫在 `data/pairs.json` 裡。
  直屬公布之後徽記不再是「找人的線索」，但仍然是隊伍的視覺識別（大螢幕上用它認隊）。
- **QR 裡編的就是那組六位數碼**，沒有姓名也沒有信箱。掃描者身分一律取自 JWT，
  伺服器自己判斷「這個碼的持有人是不是你的配對對象」——不是就一律回同一句話。
  所以 QR 被截圖亂傳沒有意義。試碼有 10 次/分鐘的上限。
- 相認紀錄寫在 `data/reveals.json`、活動狀態與完賽紀錄寫在 `data/event.json`
  （都是先寫 `.tmp` 再 `rename`）。pm2 是 fork mode / instances:1，單一 process，
  所以不需要資料庫也不會有併發問題。
- 對方掃了你之後，你這邊自己翻開，不必手動重整（平常 3 秒輪詢一次，比賽中 2 秒）。

### 逃生口（`.env.local`）

後台按壞了、JSON 寫壞了，ssh 上機改這兩顆仍然救得回來——它們的優先序在後台開關**之上**。

| env | 作用 |
| --- | --- |
| `BUDDY_FORCE_REVEAL` | `true` 全開（蓋過一切）、`false` 強制鎖（連後台開關都無效，只認現場相認）、留空 = 交給後台開關 |
| `BUDDY_REVEAL_AT` | ISO 8601 時間。後台開關關著時的兜底：過了這個時間就全開。留空 = 沒有兜底時間。 |

判斷邏輯只有 `src/lib/reveal-policy.ts` 一支，page 與兩支 API 都問它。

---

## 大螢幕（`/stage/<BUDDY_ROSTER_TOKEN>`）

投影用。**免登入**，靠不可猜的路徑保護（跟總表同一個 token）——投影電腦不必跑一次
Google 登入流程，也不怕 session 在活動中途過期斷在台上。刻意沒有導覽列與頁尾。

| 階段 | 畫面 |
| --- | --- |
| 待命 | 「準備開始」+ 全場隊數 |
| 比賽中 | 大計時器 + 已完成 N/45 + **前三名蓋成一列三等份的問號**（只是提示「這三個位子有人了」，不佔版面）+ 第四名以後的即時清單 |
| 已收場 | 頒獎。主持人按鍵逐步揭曉：第三名 → 第二名 → 第一名 → 倒數第一名 |

主持人的按鍵：**空白鍵 / → / 點畫面**推進，**←** 倒退（講錯話能回去），**Esc** 回到開頭，**F** 全螢幕。

- 一進入頒獎就把當下的資料**凍結**：台上正在念第三名時，後台若有人被手動補登，
  名次不該在布幕上跳動。倒退回開頭（Esc）會解除凍結。
- 資料每秒輪詢 `/api/stage/<token>/board`。**不用 SSE**——對外的 nginx vhost 是 root 管的，
  要加 `proxy_buffering off` 得請維運者 sudo，Cloudflare 橘雲對 SSE 也不友善。一台大螢幕每秒一次，成本可忽略。
- 送去大螢幕的只有徽記、學長姐與學弟妹姓名、秒數。**沒有信箱**，也沒有「這隊是手動補登的」
  （型別層保證：`publicStandings()` / `publicTeams()` 會把 `seniorKey` 與 `by` 剝掉）。
- 字級一律 `clamp()` + `vw`，投影機解析度不確定，寫死 px 在 1920 好看、在 1280 就爆版。

---

## 主持人控制台（`/admin`）

比賽當天的操作面板，加上「誰還沒點進來看自己的直屬」。

- **誰進得去**：JWT 的 `permissions.buddy.role === "admin"`。名單在 **auth 的 `/admin` panel** 管，
  本服務不自維護 allowlist、不吃 env。非 admin 一律 404（不透露這頁存在，同總表的中性 404）。
  寫入端點 `POST /api/admin/event` 同一條規則，非 admin 也是 404。
- **控制項**：直屬公布開關、🔫 鳴槍開始（會二次確認，提醒碼將重擲）、⏹ 收場、
  ♻️ 回到待命、即時排行榜、未完賽名單與逐隊的「登記完賽」。比賽中每 3 秒自己重新整理。
- **計次點**：個人頁 `/` 每 render 一次就 +1，寫進 `data/views.json`（同 `reveals.json` 的
  單 process 序列化 + `.tmp` → `rename` 模式）。
  ⚠️ **直屬公布開著的時候，「看過」等同「有沒有登入過」**——因為每次 render 都揭曉了。
  關著（要現場相認）時才會退回原本的語意：停在徽記畫面等相認的 render 不算。
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
> （`sync` 只動 `pairs.json`，不會碰 `event.json` / `reveals.json` / `views.json`。）
>
> 比賽期間用的是 `event.json` 裡那一場的碼，所以就算 `sync` 動到 `pairs.json` 的碼，
> 進行中的比賽也不會被影響。**比賽中才被加進名單的人**不在本場的 `codes` 裡，會退回
> `pairs.json` 的碼——配得起來，只是那組碼沒經過本場重擲。要一致就重新鳴槍一場。

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

### 附身：用別人的身分看畫面（`BUDDY_DEV_AS`）

個人頁只顯示「你自己那一組」，所以要驗證某個人看到什麼（他的直屬有沒有留言、
卡片會不會爆版），只能附身。給姓名或信箱都行：

```bash
env BUDDY_DEV_AS=陳某某 BUDDY_FORCE_REVEAL=true pnpm dev   # env 前綴：fish 也吃得下
```

- 不必動 `.env.local`（真的 process env 蓋得過 `.env` 檔），也可以寫進 `.env.local` 長期開著。
- 掛在 `getSession()` 上，所以 page、總表、兩支 API 看到的是同一個身分，不會出現
  「頁面附身了但 API 沒有」。**驗章本身一個字沒動。**
- 要配 `BUDDY_FORCE_REVEAL=true` 才看得到翻開後的正面；不加就是卡片背面（還沒相認）。
- 每次生效都印一行 `[dev-as] ⚠️`，免得忘了開著它 debug 一小時。
- 副作用：附身期間的瀏覽會記在**本機**的 `views.json` 上（掛在被附身者名下）。
  那個檔不會上主機（`push:data` 只送 `pairs.json` / `profiles.json`），線上統計不受影響。

生產環境恆為 no-op：`NODE_ENV === "production"` 直接回 null（Next 會 inline 掉，
正式 build 裡是死碼），主機的 `.env.local` 也沒有這顆 env。實作見 `src/lib/dev-session.ts`。

### 偽造一場比賽（`pnpm seed:race`）

大螢幕的頒獎動畫沒有完賽紀錄就什麼都看不到，所以有這支：

```bash
pnpm seed:race            # 32 隊完賽、已收場（可以直接按空白鍵頒獎）
pnpm seed:race 12         # 只讓 12 隊完賽
pnpm seed:race 20 racing  # 比賽進行中，測即時排行榜那個畫面
pnpm seed:race clear      # 清掉，回到待命
```

直接寫 `data/event.json`（會保留你切好的 `publicReveal`）。**`pnpm push:data` 不送這個檔**，
所以本機怎麼玩都波及不到主機；這支也拒絕在 `NODE_ENV=production` 下執行。

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
4. 主機：`rm -rf /home/service/tpass-buddy`（**含 `data/` 底下的 `pairs.json`、`event.json`、
   `reveals.json`、`views.json`、`profiles.json`，個資一併清掉**）
5. Cloudflare 刪掉 `buddy` 的 A record；請 root 移除 nginx server block
