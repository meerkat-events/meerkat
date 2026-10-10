import { Icon, IconButton, Popover, Portal } from "@chakra-ui/react";
import { LuInfo } from "react-icons/lu";
import { RELEVANCE_LEVELS } from "./question-state.ts";

/**
 * An info button next to a "Relevance" heading that explains the score. A
 * popover rather than a tooltip, so it also opens on tap and by keyboard.
 */
export function RelevanceInfo() {
  return (
    <Popover.Root positioning={{ placement: "bottom-end" }}>
      <Popover.Trigger asChild>
        <IconButton
          size="2xs"
          variant="ghost"
          colorPalette="gray"
          color="fg.muted"
          aria-label="How relevance is scored"
          className="m-info"
        >
          <Icon as={LuInfo} />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content className="m-menu m-popover">
            <Popover.Body>
              <Popover.Title>How relevance is scored</Popover.Title>
              <p>
                When a question is asked, the moderation model also rates how
                relevant it is to the conference, the talk's topic and its
                speaker, from 0 to 4:
              </p>
              <ul>
                {RELEVANCE_LEVELS.map((level, score) => (
                  <li key={level.name}>
                    <b>{score} · {level.name}</b>: {level.means}
                  </li>
                ))}
              </ul>
              <p>
                The score weighs these levels by how sure the model is, so 2.6
                lies between Related and Highly relevant. It never hides a
                question, and questions are only scored when moderation is on.
              </p>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
