import env from "../env.ts";
import { createHub } from "./hub.ts";
import { createPostgresBus } from "./postgres-bus.ts";

// Neither connects at import: the bus LISTENs on the hub's first listener, or
// when main.ts starts the hub. Moving to another transport (Redis pub/sub)
// means creating a different `Bus` here.
export const bus = createPostgresBus(env.connectionString);
export const hub = createHub(bus);
