import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const sdk = fileURLToPath(new URL("./partii-sdk/", import.meta.url));

// Two builds: `npm run build` (staging, dist/) and `npm run build:prod` (production, dist-prod/).
// Each mode reads its own .env.<mode>: the API, the publishable key and the game id.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (mode === "production" && !/^pk_/.test(env.VITE_PARTII_KEY ?? "")) {
    throw new Error("Production build: put your production publishable key (pk_...) in .env.production");
  }
  if (mode === "production" && /staging/.test(env.VITE_PARTII_API ?? "")) {
    throw new Error("Production build points at a staging API: fix VITE_PARTII_API in .env.production");
  }
  return {
    resolve: {
      alias: [
        { find: /^@partii\/sdk$/, replacement: `${sdk}client.ts` },
        { find: /^@partii\/sdk\/(.*)$/, replacement: `${sdk}$1.ts` },
      ],
    },
    build: { outDir: mode === "production" ? "dist-prod" : "dist", emptyOutDir: true },
    test: {
      environment: "node",
      include: ["test/**/*.test.ts"],
      // Every test has a hard cap; the staging calls themselves time out at 15 s (the SDK's default).
      testTimeout: 30_000,
      hookTimeout: 30_000,
      teardownTimeout: 10_000,
    },
  };
});
