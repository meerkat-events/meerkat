import { getQuestions } from "./models/questions.ts";
import { createQuestionListCache } from "./question-list-cache.ts";
import { bus } from "./realtime/index.ts";

/** This instance's shared guest question lists (see `question-list-cache.ts`). */
export const guestQuestionLists = createQuestionListCache({
  bus,
  load: (eventId, sort) => getQuestions(eventId, sort),
});
