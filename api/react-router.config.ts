import type { Config } from "@react-router/dev/config";

export default {
  // The server renders every page, in its conference's theme: the layouts'
  // server loaders read it from the database (see CLAUDE.md, "Frontend").
  ssr: true,
  // Those loaders run per request, so there is nothing to prerender.
  prerender: false,
  // React Router v8 enables middleware, split route modules, the Vite
  // Environment API, pass-through requests and trailing-slash-aware data
  // requests by default; they were this app's v8_* future flags on v7.
} satisfies Config;
