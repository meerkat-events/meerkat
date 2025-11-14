import type { PODData } from "@parcnet-js/podspec";
export type Theme = {
  brandColor: string;
  contrastColor: string;
  background: string;
  textColor: string;
  systemTheme?: "dark" | "light";
  headingFontFamily?: string;
  bodyFontFamily?: string;
};

export type Conference = {
  id: number;
  name: string;
  logoUrl: string | null;
  theme: Theme | null;
  features: Record<string, boolean>;
};

export type Event = {
  id: number;
  uid: string;
  conferenceId: number;
  title: string;
  start: Date;
  end: Date;
  description: string | null;
  cover: string | null;
  questions: Question[];
  votes: number;
  participants: number;
  speaker: string;
  stage: string;
  conference: Conference;
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
