#!/usr/bin/env node
// data/pairs.json → 主機。這是資料唯一的上機管道。
//
// 為什麼不走 git：pairs.json 是完整個資，而本 repo 是 public。
// 為什麼不走 deploy.sh：那條路只有 `git pull`，搬不了 gitignored 的檔案。
// 所以走 ssh + stdin 原子寫回，跟 ops 的 scripts/lib/env.mjs 寫 .env.local 同一招。
//
// 主機位址永遠只存在 ops 層 gitignored 的 deploy/host.env——本 repo 不知道主機在哪，
// 只知道怎麼呼叫 ../scripts/ssh.sh。遠端路徑同樣不寫死，從註冊表推導。
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const SERVICE_ID = "buddy";
const LOCAL = path.resolve("data/pairs.json");
const SSH = path.resolve("../scripts/ssh.sh");
const REGISTRY = path.resolve(
  process.env.TPASS_REGISTRY_PATH ?? "../tpass-registry/services.json",
);

const die = (msg) => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

if (!existsSync(LOCAL)) die(`還沒有 ${LOCAL}——先跑 pnpm sync <xlsx>`);
if (!existsSync(SSH)) die(`找不到 ${SSH}（本 repo 必須與 tpass-ops 並排 clone）`);
if (!existsSync(REGISTRY)) die(`找不到註冊表 ${REGISTRY}`);

const { services, server } = JSON.parse(readFileSync(REGISTRY, "utf8"));
const service = services.find((s) => s.id === SERVICE_ID);
if (!service) die(`註冊表裡沒有服務「${SERVICE_ID}」`);

const remoteDir = path.posix.join(server.servicesRoot, service.dir, "data");
const remote = path.posix.join(remoteDir, "pairs.json");

// 先寫 .tmp 再 mv：中途斷線也不會讓線上讀到半份 JSON。
const command = `mkdir -p '${remoteDir}' && cat > '${remote}.tmp' && mv '${remote}.tmp' '${remote}' && chmod 600 '${remote}' && wc -c < '${remote}'`;

const result = spawnSync(SSH, [command], {
  input: readFileSync(LOCAL),
  stdio: ["pipe", "inherit", "inherit"],
});

if (result.error) die(`執行 ssh.sh 失敗：${result.error.message}`);
if (result.status !== 0) die(`ssh.sh 以狀態碼 ${result.status} 結束，資料未更新`);

console.log(`✅ 已送到主機 ${remote}（上面印的是位元組數）`);
console.log(`   不需要重新部署，重整頁面即生效。`);
