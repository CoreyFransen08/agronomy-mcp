import { z } from "zod";

export const forceRefreshField = {
  forceRefresh: z
    .boolean()
    .default(false)
    .describe(
      "Set to true to bypass the cache and fetch fresh data from the API."
    ),
};
