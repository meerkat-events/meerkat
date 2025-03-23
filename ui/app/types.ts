import type { PODData } from "@parcnet-js/podspec";

// TDOO: Get interface from api
export type User = {
  uid: string;
  createdAt: Date;
  name?: string | undefined;
  hash?: string | undefined;
  rank?: 0 | number | undefined;
  points?: 0 | number | undefined;
};

export type Conference = {
  id: number;
  name: string;
  logoUrl: string | null;
};

export type Event = {
  id: number;
  uid: string;
  conferenceId: number;
  title: string;
  submissionType: string;
  start: Date;
  end: Date;
  "abstract": string | null;
  description: string | null;
  track: string | null;
  cover: string | null;
  questions: Question[];
  votes: number;
  participants: number;
  speaker: string;
  conference: Conference;
  features: Record<string, boolean>;
};

export type Question = {
  id: number;
  eventId: number;
  uid: string;
  votes: number;
  question: string;
  createdAt: Date;
  answeredAt?: Date | undefined;
  user?: {
    uid: string;
    name?: string | undefined;
  } | undefined;
};

export type EventPod = {
  uid: string;
  event: Event;
  pod: PODData;
  createdAt: Date;
};

export type Reaction = {
  created_at: string;
  event_id: number;
  uid: string;
};

export type ConferenceTicket = {
  collectionName: string;
  signerPublicKey: string;
  eventId: string;
  productId: string;
  role: string;
};
