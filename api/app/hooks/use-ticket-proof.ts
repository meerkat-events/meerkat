import { useContext, useState } from "react";
import { useZAPIConnect } from "../zapi/connect.ts";
import type { User } from "../types.ts";
import { type ParcnetAPI } from "@parcnet-js/app-connector";
import {
  type TicketClassificationTuples,
  type TicketProofRequest,
  ticketProofRequest,
} from "@parcnet-js/ticket-spec";
import { posthog } from "posthog-js";
import { UserContext } from "../context/user.tsx";
import { getConferenceTickets } from "./use-conference-tickets.ts";
import { useZAPI } from "../zapi/context.tsx";
import { constructZapp } from "../zapi/zapps.ts";
import type { Conference } from "~/types.ts";
import { collectionName } from "~/zapi/collections.ts";

export type UseTicketProofProps = {
  conference?: Conference | undefined;
  onError?: (error: Error) => void;
};

export const minimumFieldsToReveal: TicketProofRequest["fieldsToReveal"] = {
  owner: true,
  eventId: true,
  productId: true,
};

export function useTicketProof(props: UseTicketProofProps) {
  const { setUser } = useContext(UserContext);
  const fieldsToReveal = minimumFieldsToReveal;
  const [isLoading, setLoading] = useState(false);
  const { connect } = useZAPIConnect();
  const context = useZAPI();

  const login = async () => {
    let user: User | undefined;
    let ticketProof: ProveResult | undefined;
    try {
      setLoading(true);
      if (!props.conference?.id) {
        throw new Error("Conference ID is required");
      }
      const tickets = await getConferenceTickets(props.conference.id!);
      const ticketCollectionsSet = new Set(
        tickets.map((ticket) => ticket.collectionName),
      );
      const ticketClassificationTuples = tickets.map((ticket) => ({
        eventId: ticket.eventId,
        signerPublicKey: ticket.signerPublicKey,
        ...(ticket.productId ? { productId: ticket.productId } : {}),
      }));
      const collection = collectionName(
        context?.config.zappName ?? "",
        props.conference.name,
      );
      const zapi = await connect(
        constructZapp(
          context?.config.zappName ?? "",
          [collection],
          Array.from(ticketCollectionsSet),
        ),
      );
      ticketProof = await generateTicketProof(
        zapi,
        ticketClassificationTuples,
        fieldsToReveal,
      );
      user = await sendTicketProofRequest({ ticketProof });
      setUser(user);
      posthog.capture("user_logged_in");
    } catch (error) {
      props.onError?.(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
    return { user, ticketProof };
  };

  return { login, isLoading };
}

export type ProveResult = Awaited<ReturnType<typeof generateTicketProof>>;

async function sendTicketProofRequest(
  { ticketProof }: { ticketProof: any },
) {
  const {
    boundConfigToJSON,
    revealedClaimsToJSON,
  } = await import("@pcd/gpc");

  let revealedClaims: any;
  let boundConfig: any;
  try {
    revealedClaims = revealedClaimsToJSON(ticketProof.revealedClaims);
    boundConfig = boundConfigToJSON(ticketProof.boundConfig);
  } catch (error) {
    throw new TicketProofError(
      "Missing ticket. Try another email address or check zupass.org for your ticket first.",
      "missing_ticket_proof",
    );
  }

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/v1/users/prove`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        proof: ticketProof.proof,
        revealedClaims,
        boundConfig,
      }),
    },
  );
  if (!response.ok) {
    throw new Error("Failed to login");
  }
  const { data: { user } } = await response.json();
  return user as User;
}

function generateTicketProof(
  zapi: ParcnetAPI,
  classificationTuples: TicketClassificationTuples,
  fieldsToReveal: TicketProofRequest["fieldsToReveal"],
) {
  const request = ticketProofRequest({
    classificationTuples,
    fieldsToReveal,
  });

  return zapi.gpc.prove({ request: request.schema });
}

class TicketProofError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "TicketProofError";
    this.code = code;
  }
}
