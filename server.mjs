// HTTPS 自訂伺服器：tpass-buddy 跑在 buddy.lvh.me:3008，
// 與其他 tpass 服務同一組 mkcert 憑證。
// 此檔不經 Next 編譯，語法須與當前 Node 相容。
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import pkg from "@next/env";
import next from "next";

const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

const port = Number(process.env.PORT || 3008);
const hostname = process.env.HOSTNAME || "buddy.lvh.me";

const httpsOptions = {
  key: readFileSync(process.env.TLS_KEY_FILE),
  cert: readFileSync(process.env.TLS_CERT_FILE),
};

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();
createServer(httpsOptions, (req, res) => handle(req, res)).listen(port, () => {
  console.log(`> tpass-buddy ready on https://${hostname}:${port}`);
});
