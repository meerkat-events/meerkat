import zod from "zod";

/**
 * The `:id` of a conference route, an integer. Routes with more parameters
 * extend it: a route's second `zValidator("param")` would replace the first's
 * result.
 */
export const conferenceParams = zod.object({
  // Digits only: Number() alone would read "0x1F" or "1e2" as other ids.
  id: zod.string().regex(/^\d+$/).transform(Number),
});
