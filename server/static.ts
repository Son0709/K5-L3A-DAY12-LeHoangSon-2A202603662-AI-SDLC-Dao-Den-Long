// Minimal static file server for the built client (dist/). No dependencies.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".ico": "image/x-icon", ".map": "application/json",
};

export type Handler = (req: IncomingMessage, res: ServerResponse) => boolean | Promise<boolean>;

/** Serves `root` and lets `extra` handlers (for example the leaderboard API) answer first. Port 0 picks a free port. */
export function startServer(root: string, port = 0, extra: Handler[] = []): Promise<{ url: string; port: number; close: () => Promise<void> }> {
  const base = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      for (const h of extra) if (await h(req, res)) return;
      const url = new URL(req.url ?? "/", "http://localhost");
      let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
      if (rel === "" || rel.endsWith("/") || rel.endsWith("\\")) rel = join(rel, "index.html");
      const file = resolve(base, rel);
      if (!file.startsWith(base) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404, { "content-type": "text/plain" }); res.end("not found"); return;
      }
      res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(readFileSync(file));
    } catch (e) {
      res.writeHead(500, { "content-type": "text/plain" }); res.end(String((e as Error).message));
    }
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => {
      const p = (server.address() as { port: number }).port;
      ok({ url: `http://localhost:${p}/`, port: p, close: () => new Promise<void>((done) => server.close(() => done())) });
    });
  });
}
