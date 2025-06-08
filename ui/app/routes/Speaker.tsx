import { Button, Card, Heading, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Header } from "../components/Header/Header.tsx";
import { useUser } from "../hooks/use-user.ts";
import { PrimaryButton } from "../components/Buttons/PrimaryButton.tsx";
import { useTicketProof } from "../hooks/use-ticket-proof.ts";
import { useZAPIConnect } from "../zapi/connect.ts";
import { usePods } from "../hooks/use-pods.ts";
import type { Conference, EventPod } from "../types.ts";
import { useZAPI } from "../zapi/context.tsx";
import { constructZapp } from "../zapi/zapps.ts";
import { collectionName } from "../zapi/collections.ts";
import { posthog } from "posthog-js";

/*
 * We likely will get rid of this feature soon or have to entirely redo it.
 * We don't have the e-mail of the speaker like at Devcon.
 */
const devconSEA: Conference = {
  id: 1,
  name: "Devcon SEA",
  logoUrl:
    "https://icnyvghgspgzemdudsrd.supabase.co/storage/v1/object/public/images/image.avif?t=2024-11-06T15%3A49%3A19.756Z",
  theme: null,
};

export default function Speaker() {
  const { login, isLoading } = useTicketProof({
    conference: devconSEA,
  });
  const { data: user } = useUser();
  const { connect } = useZAPIConnect();
  const context = useZAPI();
  const { data: pods, mutate: refreshPods, isLoading: isLoadingPods } =
    usePods();
  const [collected, setCollected] = useState<string[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const [toast, setToast] = useState<
    {
      title: string;
      description: string;
      status: "success" | "error";
    } | null
  >(null);

  // Simple toast implementation since useToast is no longer available
  const showToast = (toastData: {
    title: string;
    description: string;
    status: "success" | "error";
  }) => {
    setToast(toastData);
    setTimeout(() => setToast(null), 3000);
  };

  const collect = async (pod: EventPod) => {
    if (!context?.config) {
      return;
    }

    setIsCollecting(true);
    try {
      const collection = collectionName(context?.config.zappName, "Devcon SEA");
      const zapi = await connect(constructZapp(context?.config.zappName, [
        collection,
      ], []));
      await zapi.pod.collection(collection)
        .insert(pod.pod);

      setCollected([...collected, pod.uid]);

      showToast({
        title: "Feedback Collected",
        description: "Open Zupass to view it",
        status: "success",
      });
      posthog.capture("feedback_collected", {
        event_uid: pod.event.uid,
      });
    } catch (error) {
      showToast({
        title: `Error collecting feedback for ${pod.event.title}`,
        description: `Error: ${(error as Error)?.message ?? "Unknown error"}`,
        status: "error",
      });
    } finally {
      setIsCollecting(false);
    }
  };

  const handleLogin = async () => {
    await login();
    refreshPods();
  };

  const isEmailVerified = user?.hash;

  const filteredPods = pods?.filter((pod) => !collected.includes(pod.uid));

  return (
    <div className="layout">
      <header className="header">
        <div style={{ paddingBottom: "1rem", paddingTop: "1rem" }}>
          <Header title="Feedback" />
        </div>
      </header>
      <main
        className="content flex"
        style={{ gap: "1rem", marginTop: "1rem", alignItems: "center" }}
      >
        <ul style={{ display: "flex", gap: "1rem", flexFlow: "column" }}>
          {isLoadingPods
            ? <Text textAlign="center">Loading...</Text>
            : filteredPods?.length === 0
            ? <Text textAlign="center">No feedback to collect</Text>
            : filteredPods?.map((pod) => (
              <li
                key={pod.uid}
              >
                <Pod
                  pod={pod}
                  collect={collect}
                  isConnecting={isCollecting}
                />
              </li>
            ))}
        </ul>
        {!isEmailVerified && (
          <PrimaryButton
            onClick={handleLogin}
            loading={isLoading}
          >
            Login
          </PrimaryButton>
        )}
      </main>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            padding: "15px",
            backgroundColor: toast.status === "success" ? "#48BB78" : "#E53E3E",
            color: "white",
            borderRadius: "5px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div style={{ fontWeight: "bold" }}>{toast.title}</div>
          <div>{toast.description}</div>
        </div>
      )}
    </div>
  );
}

function Pod(
  { pod, isConnecting, collect }: {
    pod: EventPod;
    isConnecting: boolean;
    collect: (pod: EventPod) => Promise<void>;
  },
) {
  return (
    <Card.Root>
      <Card.Body>
        <Stack gap="4">
          <Heading size="md">{pod.event.title}</Heading>
          <Text>
            {String(pod.pod.entries.zupass_description)}
          </Text>
          <Button
            variant="outline"
            fontWeight="bold"
            py={6}
            onClick={() => collect(pod)}
            loading={isConnecting}
          >
            Collect
          </Button>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
