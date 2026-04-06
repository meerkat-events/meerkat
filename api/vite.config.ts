import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    target: "esnext",
  },
  plugins: [
    reactRouter(),
    nodePolyfills({
      include: ["buffer", "constants"],
    }),
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
      "react-dom/server": "react-dom/server.node",
    },
  },
  ssr: {
    // Bundle these packages into the server build so Vite handles CJS→ESM
    // interop internally. Without this, Node.js tries to load their ESM builds
    // at runtime, which fails because blakejs (a transitive dep) is CJS-only
    // and doesn't expose named ESM exports.
    noExternal: [
      /@pcd\//,
      /@parcnet-js\//,
      /@zk-kit\//,
      /blakejs/,
      /@semaphore-protocol\//,
    ],
    resolve: {
      conditions: ["module", "node", "development|production"],
      externalConditions: ["node"],
    },
  },
});
