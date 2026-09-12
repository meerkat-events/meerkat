import type { Config } from "@react-router/dev/config";

export default {
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // Prerendering "/" fails at build time because @pcd/pod (via @zk-kit/eddsa-poseidon)
  // imports blakejs, a CJS-only package with no named ESM exports. This crashes
  // Node.js when the prerender step tries to instantiate the SSR bundle.
  prerender: false,
  // React Router v8 enables middleware, split route modules, the Vite
  // Environment API, pass-through requests and trailing-slash-aware data
  // requests by default; they were this app's v8_* future flags on v7.
} satisfies Config;
