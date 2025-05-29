import { Flex, Heading, Skeleton } from "@chakra-ui/react";
import { type Event } from "../../types.ts";
import { AttendancePod } from "../AttendancePod.tsx";

export type CardProps = {
  event: Event | undefined;
};

export const Card = (
  { event }: CardProps,
) => {
  return (
    <>
      <div style={{ marginBottom: "1rem", marginTop: "2rem" }}>
        <AttendancePod event={event} />
      </div>
      <Flex direction="column" align="center" gap="12px">
        <Skeleton loading={!!event} width="fit-content">
          <Heading as="h1" color="white" size="lg" mb={1.5}>
            {event?.title ?? "Loading... please stand by"}
          </Heading>
        </Skeleton>
        <Flex justifyContent="space-between">
          <Skeleton loading={!!event} width="fit-content">
            <Heading
              as="h2"
              size="md"
              fontWeight="thin"
              wordBreak="break-word"
              color="white"
            >
              {event?.speaker ?? "Loading..."}
            </Heading>
          </Skeleton>
        </Flex>
      </Flex>
    </>
  );
};

export default Card;
