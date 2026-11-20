import { defineConfig } from "vite";
import { leaderboardHandler } from "./server/leaderboard-api.ts";

// `npm run dev` serves the same leaderboard API as scripts/run.ts, so scores are saved to data/leaderboard.json in both.
const leaderboardApi = () => ({
  name: "leaderboard-api",
  configureServer(server: { middlewares: { use: (fn: (req: never, res: never, next: () => void) => void) => void } }) {
    const handler = leaderboardHandler();
    server.middlewares.use((req, res, next) => { Promise.resolve(handler(req, res)).then((handled) => { if (!handled) next(); }, () => next()); });
  },
});

// Relative base so the static build (dist/) works from any folder or file server.
export default defineConfig({
  base: "./",
  plugins: [leaderboardApi()],
  build: { outDir: "dist", target: "es2022", chunkSizeWarningLimit: 900 },
});
