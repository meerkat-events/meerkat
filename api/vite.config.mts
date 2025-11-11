import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import deno from "@deno/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: "esnext",
  },
  plugins: [
    deno(),
    reactRouter(),
    nodePolyfills({
      include: ["buffer", "constants"],
    }),
  ],
  resolve: {
    alias: {
      "react-dom/server": "react-dom/server.node",
    },
  },
  ssr: {
    resolve: {
      conditions: ["module", "deno", "node", "development|production"],
      externalConditions: ["deno", "node"],
    },
  },
});
