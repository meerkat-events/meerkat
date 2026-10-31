import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "app") + path.sep;
const nodeModulesDir = path.join(__dirname, "node_modules") + path.sep;
const serverBuildDir = path.join(__dirname, "build", "server");

/**
 * Server modules outside app/ (db.ts, models/, env.ts, logger.ts, ...) stay
 * out of the server build: the built loaders import the same source files
 * main.ts already runs, so they share Hono's module instances, including its
 * one database pool, instead of bundling copies of them.
 */
function isServerSourceModule(id: string) {
  return id.startsWith(__dirname + path.sep) &&
    !id.startsWith(appDir) &&
    !id.startsWith(nodeModulesDir) &&
    id.endsWith(".ts");
}

export default defineConfig({
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          external: isServerSourceModule,
          // Imported relative to the built file, build/server/index.js.
          makeAbsoluteExternalsRelative: false,
          output: {
            paths: (id) =>
              isServerSourceModule(id)
                ? path.relative(serverBuildDir, id)
                : id,
          },
        },
      },
    },
  },
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
