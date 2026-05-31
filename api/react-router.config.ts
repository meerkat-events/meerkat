import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // Prerendering "/" fails at build time because @pcd/pod (via @zk-kit/eddsa-poseidon)
  // imports blakejs, a CJS-only package with no named ESM exports. This crashes
  // Node.js when the prerender step tries to instantiate the SSR bundle.
  prerender: false,
  // Opt in early to all React Router v8 future behaviors to silence the v7.16
  // build warnings and de-risk the eventual v8 upgrade. All five are no-op for
  // this app: there is no server `getLoadContext` or server loader/action that
  // reads `context`/`request.url`, and no custom `.data` URL handling — so
  // middleware, passThroughRequests, and trailingSlashAware adoption need no
  // code changes. splitRouteModules and viteEnvironmentApi are automatic.
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
