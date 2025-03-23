import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: "esnext",
  },
  plugins: [
    reactRouter(),
    tsconfigPaths(),
    nodePolyfills({
      include: ["buffer", "constants"],
    }),
  ],
  server: {
    allowedHosts: ["meerkat.local"],
  },
});
