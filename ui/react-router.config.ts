import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: false,
  // Prerender causes flickering during hydration
  // prerender: ["/", "/login", "/speaker"],
} satisfies Config;
