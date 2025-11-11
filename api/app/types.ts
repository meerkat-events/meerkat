import type { PODData } from "@parcnet-js/podspec";
export type Theme = {
  brandColor: string;
  contrastColor: string;
  backgroundColor: string;
  headingFontFamily?: string;
  bodyFontFamily?: string;
};

export type Conference = {
  id: number;
  name: string;
  logoUrl: string | null;
  theme: Theme | null;
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
  live: boolean;
};
export type Question = {
  id: number;
  eventId: number;
  uid: string;
  votes: number;
  question: string;
  createdAt: Date;
  answeredAt?: Date | undefined;
  selectedAt?: Date | undefined;
  user?: {
    id: string;
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
