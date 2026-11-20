// Builds the v1.0.0 release package: a folder with the built game (dist/), the small Node server that serves it and stores the
// leaderboard, and instructions. It needs only Node.js 22.18+; no npm install. Usage: node scripts/make-release.ts [version]
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const version = process.argv[2] ?? "v1.0.0";
const name = `dao-den-long-${version}`;
const stage = join("out", "release", name);

execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], { stdio: "ignore" }); // always package a fresh build
rmSync(join("out", "release"), { recursive: true, force: true });
mkdirSync(join(stage, "scripts"), { recursive: true });
mkdirSync(join(stage, "server"), { recursive: true });
mkdirSync(join(stage, "src"), { recursive: true });
cpSync("dist", join(stage, "dist"), { recursive: true });
cpSync("scripts/run.ts", join(stage, "scripts", "run.ts"));
cpSync("server/static.ts", join(stage, "server", "static.ts"));
cpSync("server/leaderboard-api.ts", join(stage, "server", "leaderboard-api.ts"));
cpSync("src/leaderboard.ts", join(stage, "src", "leaderboard.ts"));
for (const f of ["LICENSE", "CREDITS.md"]) if (existsSync(f)) cpSync(f, join(stage, f));
writeFileSync(join(stage, "package.json"), JSON.stringify({ name, version: version.replace(/^v/, ""), private: true, type: "module", scripts: { start: "node scripts/run.ts" } }, null, 2) + "\n");
writeFileSync(join(stage, "README-RUN.md"), `# Dao Den Long ${version}: ban chay duoc

Yeu cau: **Node.js 22.18 tro len** va mot trinh duyet hien dai co WebGL (da thu Chrome). Khong can \`npm install\`.

\`\`\`
node scripts/run.ts
\`\`\`

Lenh nay phuc vu game tai http://localhost:5173 (tu mo trinh duyet; them \`--no-open\` de khong mo, \`--port <so>\` de doi cong) va luu bang xep hang o \`data/leaderboard.json\`.

Xuat bang xep hang ra file:

\`\`\`
node scripts/run.ts --export-leaderboard out.json
\`\`\`

Dieu khien: W A S D di lai, Space nhay, Shift luot, E nap dom dom / chiem dau cho den, F toa sang, mui ten trai/phai hoac keo chuot xoay camera, Esc hoac P tam dung, R choi lai Dem.

Ma nguon day du, test, benchmark (\`npm run bench\`), soak (\`npm run soak\`) va bang chung: https://github.com/Son0709/K5-L3A-DAY12-LeHoangSon-2A202603662-AI-SDLC-Dao-Den-Long
Giay phep: MIT (LICENSE). Nguon va giay phep ben thu ba: CREDITS.md.
`);
console.log(`staged ${stage}`);
