import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    target: "esnext",
  },
  plugins: [reactRouter()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
      "react-dom/server": "react-dom/server.node",
    },
  },
  ssr: {
    resolve: {
      conditions: ["module", "node", "development|production"],
      externalConditions: ["node"],
    },
  },
});
