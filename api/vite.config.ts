import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";
import path from "node:path";

const apiDir = import.meta.dirname;
const appDir = path.join(apiDir, "app") + path.sep;
const nodeModulesDir = path.join(apiDir, "node_modules") + path.sep;
const serverBuildDir = path.join(apiDir, "build", "server");

/**
 * Server modules outside app/ (db.ts, models/, env.ts, logger.ts, ...) stay
 * out of the server build: the built loaders import the same source files
 * main.ts already runs, so they share Hono's module instances, including its
 * one database pool, instead of bundling copies of them.
 */
function isServerSourceModule(id: string) {
  return id.startsWith(apiDir + path.sep) &&
    !id.startsWith(appDir) &&
    !id.startsWith(nodeModulesDir) &&
    id.endsWith(".ts");
}

/**
 * The operator named on the legal page (app/routes/Legal.tsx), compiled in as
 * `__LEGAL_OPERATOR__`. LEGAL_OPERATOR is JSON, `{"name":"…","email":"…"}`,
 * from the environment (a Docker build arg on Fly, from a GitHub secret) or
 * api/.env. Unset gives null; anything else that isn't that shape fails the
 * build rather than publishing a broken page.
 */
function legalOperator(mode: string) {
  const raw = loadEnv(mode, apiDir, "")["LEGAL_OPERATOR"]?.trim();
  if (!raw) {
    return null;
  }
  const operator: unknown = JSON.parse(raw);
  if (
    typeof operator !== "object" || operator === null ||
    !("name" in operator) || typeof operator.name !== "string" ||
    !("email" in operator) || typeof operator.email !== "string"
  ) {
    throw new Error(
      'LEGAL_OPERATOR must be JSON like {"name":"…","email":"…"}',
    );
  }
  return { name: operator.name, email: operator.email };
}

export default defineConfig(({ mode }) => ({
  define: {
    __LEGAL_OPERATOR__: JSON.stringify(legalOperator(mode)),
  },
  environments: {
    // Source maps for PostHog error tracking, without a sourceMappingURL in
    // the bundles. scripts/upload-sourcemaps.sh uploads and then deletes
    // them, so they are never served.
    client: {
      build: {
        sourcemap: "hidden",
      },
    },
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
      "~": path.resolve(apiDir, "./app"),
      "react-dom/server": "react-dom/server.node",
    },
  },
  ssr: {
    // PostHog's browser packages break when Node loads them unbundled
    // (https://posthog.com/docs/libraries/react-router).
    noExternal: ["posthog-js", "@posthog/react"],
    resolve: {
      conditions: ["module", "node", "development|production"],
      externalConditions: ["node"],
    },
  },
}));
