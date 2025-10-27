import { useState } from "react";
import { type PODEntries } from "@pcd/pod";
import { type ParcnetAPI } from "@parcnet-js/app-connector";
import type { Event } from "../types.ts";
import { type PODData } from "@parcnet-js/podspec";
import { posthog } from "posthog-js";
import { feedbackPodType } from "../utils/pod.client.ts";

export function useProvideFeedback({
  onError,
}: {
  onError?: (error: Error) => void;
} = {}) {
  const [isLoading, setIsLoading] = useState(false);

  const provideFeedback = async ({
    zapi,
    event,
    text,
    email,
    name,
  }: {
    zapi: ParcnetAPI;
    event: Event;
    text: string;
    email: string | undefined;
    name: string | undefined;
  }) => {
    setIsLoading(true);
    try {
      const podData = constructPODEntries({
        event,
        text,
        email,
        name,
      });
      const pod = await (zapi as ParcnetAPI).pod.sign(podData);
      (zapi as ParcnetAPI).pod.collection("")
        .insert(pod);
      await sendFeedback(event, pod);
      posthog.capture("feedback_provided", {
        event_uid: event?.uid,
      });
    } catch (error) {
      onError?.(error as Error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    provideFeedback,
    isLoading,
  };
}

function constructPODEntries({
  event,
  text,
  email,
  name,
}: {
  event: Event;
  text: string;
  email: string | undefined;
  name: string | undefined;
}): PODEntries {
  return {
    code: {
      type: "string",
      value: event.uid,
    },
    zupass_display: {
      type: "string",
      value: "collectable",
    },
    zupass_title: {
      type: "string",
      value: `Feedback: ${event.title}`,
    },
    zupass_image_url: {
      type: "string",
      value:
        "https://icnyvghgspgzemdudsrd.supabase.co/storage/v1/object/public/global/logo.png",
    },
    zupass_description: {
      type: "string",
      value: text,
    },
    pod_type: {
      type: "string",
      value: feedbackPodType,
    },
    version: {
      type: "string",
      value: "2.0.0",
    },
    created_at: {
      type: "date",
      value: new Date(),
    },
    ...(name ? { name: { type: "string", value: name } } : {}),
    ...(email ? { email: { type: "string", value: email } } : {}),
  };
}

async function sendFeedback(event: Event, pod: PODData) {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/v1/events/${event.uid}/feedback`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pod),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to send feedback: ${response.statusText}`);
  }

  return response.json();
}
