import { useState } from "react";
import { Skeleton } from "@chakra-ui/react";
import { type Event } from "../types.ts";

export type AttendancePodProps = {
  event?: Event | undefined;
};

export function AttendancePod({ event }: AttendancePodProps) {
  const [isLoading, setIsLoading] = useState(true);
  return (
    <div className="collect-card-image">
      <Skeleton loading={isLoading} width={260} height={260}>
        {event?.cover
          ? (
            <img
              src={event?.cover}
              alt={event?.title}
              style={{ height: 260, margin: "0 auto" }}
              onLoad={() => setIsLoading(false)}
            />
          )
          : null}
      </Skeleton>
    </div>
  );
}
