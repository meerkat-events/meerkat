import type { Config } from "@react-router/dev/config";

export default {
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // Layouts load their data in `clientLoader`; nothing is worth prerendering.
  prerender: false,
  // React Router v8 enables middleware, split route modules, the Vite
  // Environment API, pass-through requests and trailing-slash-aware data
  // requests by default; they were this app's v8_* future flags on v7.
} satisfies Config;
