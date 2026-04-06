import { createRequire } from "module";

// @pcd/pod's ESM build pulls in @zk-kit/eddsa-poseidon → blakejs (CJS-only),
// which breaks Node.js named ESM imports at runtime (when loaded by tsx).
// Force CJS loading so Node resolves the CommonJS bundle instead.
// Note: the Vite SSR build is handled separately via ssr.noExternal in vite.config.ts.
const _require = createRequire(import.meta.url);
const pod = _require("@pcd/pod") as typeof import("@pcd/pod");

export const { POD } = pod;
export type { PODEntries } from "@pcd/pod";
