// SCAFFOLD ONLY: placeholder to prove Node runs TypeScript and the CLI contract
// (args, exit codes). Replaced by the real simulation in the next step.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const out = arg("out");
const ticks = Number(arg("ticks"));
if (!out || !Number.isInteger(ticks) || ticks < 0) {
  process.stderr.write("usage: --seed <int> --night 1 --ticks <int> --out <file.jsonl>\n");
  process.exit(1);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ type: "hello", ticks }) + "\n");
