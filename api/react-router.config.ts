import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // Prerendering "/" fails at build time because @pcd/pod (via @zk-kit/eddsa-poseidon)
  // imports blakejs, a CJS-only package with no named ESM exports. This crashes
  // Node.js when the prerender step tries to instantiate the SSR bundle.
  prerender: false,
} satisfies Config;
