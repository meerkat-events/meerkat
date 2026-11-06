import zod from "zod";

/**
 * The `:id` of a conference route, an integer. Routes with more parameters
 * extend it: a route's second `zValidator("param")` would replace the first's
 * result.
 */
export const conferenceParams = zod.object({ id: zod.coerce.number().int() });
