import { getConferenceById, toApiConference } from "./conferences.ts";
import { countParticipants, type Event } from "./events.ts";
import { getFeatures } from "./features.ts";
import { getQuestions, type Questions } from "./questions.ts";

/** How many answered questions the high engagement presenter view shows. */
export const RECENTLY_ANSWERED_LIMIT = 8;

/** A question as the API returns it: the author's id and name, no viewer data. */
export function toApiQuestion(
  { userId: _userId, user, viewerVoteWeight: _viewerVoteWeight, ...rest }:
    Questions[number],
) {
  return {
    ...rest,
    user: user
      ? {
        id: user.id,
        name: user.userMetadata?.["name"] ?? user.id,
      }
      : undefined,
  };
}

/**
 * The event as guests see it (`GET /api/v1/events/:uid`): its visible,
 * unanswered questions, most popular first, the vote and participant counts,
 * and its conference with the feature flags. In high engagement mode it also
 * carries the latest answered questions, newest first (`recentlyAnswered`,
 * empty otherwise). The presenter view's loaders render it on the server.
 * Null when the event's conference is gone.
 */
export async function getPublicEvent(event: Event) {
  const [conference, questions, answered, participants, features] =
    await Promise.all([
      getConferenceById(event.conferenceId),
      getQuestions(event.id, "popular", false),
      // Answered questions come newest first. A session has few of them,
      // so cutting the list here is cheap enough.
      event.highEngagement ? getQuestions(event.id, "popular", true) : [],
      countParticipants(event.id),
      getFeatures(event.conferenceId),
    ]);

  if (!conference) {
    return null;
  }

  const featureFlags: Record<string, boolean> = {};
  for (const feature of features) {
    featureFlags[feature.name] = feature.active;
  }

  return {
    ...event,
    questions: questions.map(toApiQuestion),
    recentlyAnswered: answered.slice(0, RECENTLY_ANSWERED_LIMIT)
      .map(toApiQuestion),
    votes: questions.reduce((total, question) => total + question.votes, 0),
    participants,
    conference: {
      ...toApiConference(conference),
      features: featureFlags,
    },
  };
}
