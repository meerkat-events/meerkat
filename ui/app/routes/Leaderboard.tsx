import { useEffect, useState } from "react";
import { ArrowBackIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import {
  Badge,
  Flex,
  Heading,
  Link,
  Table,
  TableCaption,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { Header } from "../components/Header/Header.tsx";
import { useUser } from "../hooks/use-user.ts";
import { useLeaderboard } from "../hooks/use-leaderboard.ts";
import { Link as ReactRouterLink, useNavigate } from "react-router";
import { PrimaryButton } from "../components/Buttons/PrimaryButton.tsx";
import { StarIcon } from "@chakra-ui/icons";
import { useTicketProof } from "../hooks/use-ticket-proof.ts";
import { useZAPIConnect } from "../zapi/connect.ts";
import { useZAPI } from "../zapi/context.tsx";
import { posthog } from "posthog-js";
import { useZupassPods } from "../hooks/use-zupass-pods.ts";
import { summaryPodType } from "../utils/pod.client.ts";
import { useUserStats } from "../hooks/use-user-stats.ts";
import { useSummaryPOD } from "../hooks/use-summary-pod.ts";
import { POD } from "@pcd/pod";
import JSConfetti from "js-confetti";
import { constructPODZapp } from "../zapi/zapps.ts";
import { collectionName } from "../zapi/collections.ts";
import { isError } from "../utils/error.ts";

export default function Leaderboard() {
  const {
    data,
    // mutate: refreshLeaderboard,
    // isValidating: isLeaderboardLoading,
  } = useLeaderboard();
  const { data: userStats } = useUserStats();

  const {
    data: user,
    // mutate: refreshUser,
    // isValidating: isUserLoading,
    isAuthenticated,
  } = useUser();

  const isUserInLeaderboard = data?.some((p) => p.name === user?.name);

  // const refresh = () => {
  //   refreshLeaderboard();
  //   refreshUser();
  // };

  const navigate = useNavigate();

  // const isLoading = isLeaderboardLoading || isUserLoading;

  const { login } = useTicketProof({
    conferenceId: 1,
  });
  const { connect, isConnected } = useZAPIConnect();
  const context = useZAPI();
  const [isCollected, setIsCollected] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const toast = useToast();
  const { getZupassPods } = useZupassPods();
  const { trigger: fetchSummaryPod } = useSummaryPOD();
  const collection = collectionName(context?.config.zappName ?? "", "Devcon SEA");
  const podZapp = constructPODZapp(
    context?.config.zappName ?? "",
    [collection],
  );

  useEffect(() => {
    if (!context?.zapi || !isConnected) return;

    const func = async () => {
      const pods = await getZupassPods(context.zapi!, collection, summaryPodType);
      setIsCollected(pods.length > 0);
    };

    func();
  }, [isConnected, context?.zapi, collection]);

  const collect = async () => {
    setIsCollecting(true);
    try {
      if (!isAuthenticated) {
        await login();
      }

      const zapi = await connect(podZapp);

      const pods = await getZupassPods(zapi, collection, summaryPodType);
      const hasSummaryPod = pods.length > 0;

      if (hasSummaryPod) {
        toast({
          title: "Summary Already Claimed",
          description: "Open Zupass to view it",
          status: "info",
        });
        return;
      }

      const { data } = await fetchSummaryPod();
      const pod = POD.fromJSON(data);

      await zapi.pod.collection(collection)
        .insert({
          entries: pod.content.asEntries(),
          signature: pod.signature,
          signerPublicKey: pod.signerPublicKey,
        });

      toast({
        title: "Summary Claimed",
        description: "Open Zupass to view it",
        status: "success",
      });
      const jsConfetti = new JSConfetti();
      jsConfetti.addConfetti();
      setIsCollected(true);
      posthog.capture("summary_claimed");
    } catch (error) {
      toast({
        title: "Error claiming summary",
        description: `Error: ${isError(error) ? error.message : "Unknown error"
          }`,
        status: "error",
      });
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <div className="layout">
      <header className="header">
        <nav>
          <Link
            as={ReactRouterLink}
            onClick={(e) => {
              e.preventDefault();
              navigate(-1);
            }}
          >
            <Flex
              flexDirection="row"
              gap="1"
              alignItems="center"
              padding="0.5rem 0 0 1rem"
              minHeight="1rem"
            >
              <ArrowBackIcon /> <span>Back</span>
            </Flex>
          </Link>
        </nav>
        <Header title="Top Participants" />
      </header>
      <main className="content flex" style={{ overflowY: "auto" }}>
        <Flex gap={4} flexDirection="column" alignItems="center">
          <Heading as="h3" size="md" mt={4} color="white" textAlign="center">
            Devcon 7 SEA 🦄 was awesome! Thanks to your contribution 💜:
          </Heading>
          <Flex color="white">
            {userStats?.answeredQuestions
              ? (
                <>
                  {userStats?.answeredQuestions} questions answered
                  <br />
                </>
              )
              : null}
            {userStats?.receivedVotes
              ? (
                <>
                  {userStats?.receivedVotes} votes received
                  <br />
                </>
              )
              : null}
            {userStats?.questions
              ? (
                <>
                  {userStats?.questions} questions asked
                  <br />
                </>
              )
              : null}
            {userStats?.votes
              ? (
                <>
                  {userStats?.votes} votes given
                  <br />
                </>
              )
              : null}
            {userStats?.reactions
              ? (
                <>
                  {userStats?.reactions} heart reactions
                  <br />
                </>
              )
              : null}
          </Flex>
          {isCollected
            ? (
              <p>
                <Link
                  href="https://zupass.org"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Zupass <ExternalLinkIcon />
                </Link>{" "}
                to view your summary POD.
              </p>
            )
            : (
              <>
                <PrimaryButton
                  leftIcon={<StarIcon />}
                  onClick={collect}
                  isLoading={isCollecting}
                  loadingText="Claiming..."
                  className={!isCollecting ? "pulsating" : ""}
                >
                  Claim your Reward
                </PrimaryButton>
                <Text>
                  Claiming your reward stores a contribution summary into
                  Zupass.
                </Text>
              </>
            )}
        </Flex>
        <TableContainer style={{ overflow: "unset" }}>
          <Flex justifyContent="flex-end" margin="1rem 0">
            {
              /* <Button
              leftIcon={<RepeatIcon />}
              onClick={refresh}
              variant="outline"
              disabled={isLoading}
              isLoading={isLoading}
              loadingText="Refreshing..."
            >
              Refresh
            </Button> */
            }
          </Flex>
          <Table variant="simple" size="sm">
            <TableCaption>
              Each answered question is 10 points, every vote is 1 point
            </TableCaption>
            <Thead>
              <Tr>
                <Th>#</Th>
                <Th>Name</Th>
                <Th isNumeric>🦄</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data?.map((participant) => (
                <Tr key={participant.name}>
                  <Td>{participant.rank}</Td>
                  <Td>
                    {participant.name}
                    {participant.name === user?.name && (
                      <>
                        &nbsp;
                        <Badge colorScheme="purple" variant="solid">You!</Badge>
                      </>
                    )}
                  </Td>
                  <Td isNumeric>{participant.points}</Td>
                </Tr>
              ))}
              {!isUserInLeaderboard && user && (
                <Tr key={user.name}>
                  <Td>{user.rank ?? "-"}</Td>
                  <Td>
                    {user.name}&nbsp;
                    <Badge colorScheme="purple" variant="solid">You!</Badge>
                  </Td>
                  <Td isNumeric>{user.points}</Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </TableContainer>
      </main>
    </div>
  );
}
