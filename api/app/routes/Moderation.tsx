import { Button, Flex, Heading, Icon, Table, Text } from "@chakra-ui/react";
import { FiRefreshCw } from "react-icons/fi";
import { useAllQuestions } from "../hooks/use-all-questions.ts";
import { useDeleteQuestion } from "../hooks/use-delete-question.ts";
import { qa } from "../routing.ts";
import { toaster } from "~/components/ui/toaster.tsx";

export default function Moderation() {
  const { data: questions, mutate: refreshQuestions, isLoading, isValidating } =
    useAllQuestions();

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading as="h1" size="2xl">
          Moderation
        </Heading>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refreshQuestions()}
          loading={isValidating}
        >
          <Icon as={FiRefreshCw} />
          Refresh
        </Button>
      </Flex>

      {isLoading
        ? (
          <Flex alignItems="center" justifyContent="center" minHeight="400px">
            <Text color="gray.400">Loading...</Text>
          </Flex>
        )
        : !questions || questions.length === 0
        ? (
          <Flex alignItems="center" justifyContent="center" minHeight="400px">
            <Text color="gray.400">No questions yet.</Text>
          </Flex>
        )
        : (
          <Table.Root variant="outline" size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Question</Table.ColumnHeader>
                <Table.ColumnHeader>User</Table.ColumnHeader>
                <Table.ColumnHeader>Event</Table.ColumnHeader>
                <Table.ColumnHeader>Created</Table.ColumnHeader>
                <Table.ColumnHeader>Votes</Table.ColumnHeader>
                <Table.ColumnHeader>Actions</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {questions.map((question) => (
                <QuestionRow
                  key={question.uid}
                  question={question}
                  onDelete={refreshQuestions}
                />
              ))}
            </Table.Body>
          </Table.Root>
        )}
    </div>
  );
}

function QuestionRow(
  { question, onDelete }: {
    question: {
      uid: string;
      question: string;
      user?: { id: string; name?: string };
      event: { id: number; uid: string; title: string };
      createdAt: Date;
      votes: number;
    };
    onDelete: () => void;
  },
) {
  const { trigger: deleteQuestion } = useDeleteQuestion(question.uid);

  const handleDelete = async () => {
    try {
      await deleteQuestion();
      onDelete();
      toaster.create({
        title: "Question hidden",
        type: "success",
        duration: 2000,
      });
    } catch (error) {
      toaster.create({
        title: "Failed to hide question",
        type: "error",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const createdDate = new Date(question.createdAt);
  const formattedDate = createdDate.toLocaleString();

  return (
    <Table.Row>
      <Table.Cell maxWidth="400px">
        <Text
          fontSize="sm"
          overflow="hidden"
          textOverflow="ellipsis"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {question.question}
        </Text>
      </Table.Cell>
      <Table.Cell>
        <Text fontSize="sm">
          {question.user?.name ?? question.user?.id ?? "Unknown"}
        </Text>
      </Table.Cell>
      <Table.Cell maxWidth="250px">
        <Text
          fontSize="sm"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {question.event.title}
        </Text>
      </Table.Cell>
      <Table.Cell>
        <Text fontSize="sm" whiteSpace="nowrap">
          {formattedDate}
        </Text>
      </Table.Cell>
      <Table.Cell>
        <Text fontSize="sm">{question.votes}</Text>
      </Table.Cell>
      <Table.Cell>
        <Flex gap={2}>
          <Button
            size="xs"
            colorPalette="red"
            variant="outline"
            onClick={handleDelete}
          >
            Hide
          </Button>
          <Button
            size="xs"
            colorPalette="blue"
            variant="outline"
            asChild
          >
            <a
              href={qa(question.event.uid)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open QA
            </a>
          </Button>
        </Flex>
      </Table.Cell>
    </Table.Row>
  );
}
