import type { ConferenceTicket } from "../types.ts";
import { extractHTTPError } from "./request.ts";

export async function getConferenceTickets(
  conferenceId: number,
): Promise<ConferenceTicket[]> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/v1/conferences/${conferenceId}/tickets`,
  );
  if (!response.ok) {
    throw await extractHTTPError(response);
  }
  const { data: tickets } = await response.json();
  return tickets;
}
