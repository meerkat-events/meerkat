import { Box, Flex, Link, List, Text } from "@chakra-ui/react";
import type React from "react";
import { useEffect } from "react";
import { useLocation } from "react-router";
import { Logo } from "../components/Logo.tsx";
import type { Route } from "./+types/Legal.ts";

// The operator, who is also the contact for privacy requests and the
// Grievance Officer for users in India.
const OPERATOR_NAME = "Florian Dreschner";
const CONTACT_EMAIL = "code@dreschner.eu";

const LAST_UPDATED = "1 November 2026";

export const meta: Route.MetaFunction = () => [
  { title: "Privacy policy and terms · Meerkat" },
];

/**
 * The privacy policy and the terms and conditions, on one page with an anchor
 * each (#privacy, #terms). Linked from the navigation drawer's footer.
 */
export default function Legal() {
  // The page renders after hydration, too late for the browser's own jump
  // to #privacy or #terms when the link is opened directly.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))
        ?.scrollIntoView();
    }
  }, [hash]);

  return (
    <div className="layout">
      <header className="header">
        <Flex justifyContent="center" padding="1.5rem 1rem 0.5rem">
          <Logo height="40px" width="auto" />
        </Flex>
      </header>
      <main className="content">
        <Flex flexDirection="column" gap="10" paddingBlock="6">
          <Flex flexDirection="column" gap="2">
            <Text as="h1" fontSize="2xl" fontWeight="bold">
              Privacy policy and terms
            </Text>
            <Text color="gray.400" fontSize="sm">
              Last updated {LAST_UPDATED}. Jump to the{" "}
              <Link href="#privacy" textDecoration="underline">
                privacy policy
              </Link>{" "}
              or the{" "}
              <Link href="#terms" textDecoration="underline">
                terms and conditions
              </Link>
              .
            </Text>
          </Flex>
          <PrivacyPolicy />
          <Terms />
        </Flex>
      </main>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <Box as="section" id="privacy" display="flex" flexDirection="column" gap="6">
      <Text as="h2" fontSize="xl" fontWeight="bold">
        Privacy policy
      </Text>
      <Paragraph>
        Meerkat lets conference attendees ask questions, vote and react during
        talks, and lets organizers moderate them. This policy explains what
        personal data Meerkat processes, why, who receives it and what your
        rights are. The organizer of a conference may have its own privacy
        policy for the conference itself.
      </Paragraph>

      <Section title="Who is responsible">
        <Paragraph>
          {OPERATOR_NAME} ("we") operates Meerkat. Contact
          us about privacy at {CONTACT_EMAIL}.
        </Paragraph>
        <Paragraph>
          Grievance Officer for users in India: {OPERATOR_NAME},{" "}
          {CONTACT_EMAIL}.
        </Paragraph>
      </Section>

      <Section title="What we collect">
        <Bullets
          items={[
            <>
              <b>When you open a page:</b>{" "}
              your IP address, browser and device type, the pages you view and
              what you tap, and errors that occur. Our analytics stores a
              pseudonymous identifier on your device to recognise repeat
              visits. Once you join a conversation, analytics, logs and error
              reports are linked to your user id.
            </>,
            <>
              <b>When you join a conversation:</b>{" "}
              an account with a user id and a randomly generated display name.
              If you sign in with an email code, or open a session from a
              conference app, we also store your email address. The conference
              app passes it to us when it signs you in.
            </>,
            <>
              <b>What you post:</b>{" "}
              your questions, votes, supervotes and reactions, when you posted
              them, and whether a question was selected, answered, hidden or
              deleted. From your activity we calculate points and a tier for
              each conference. If your account is blocked, we store until when.
            </>,
            <>
              <b>Organizers and moderators:</b>{" "}
              the email address they were invited with and their role in the
              conference.
            </>,
            <>
              <b>Feedback:</b>{" "}
              what you write in the "Give feedback" form.
            </>,
          ]}
        />
      </Section>

      <Section title="Why we use it">
        <Bullets
          items={[
            "To run the Q&A: show questions, count votes, sign you in and let organizers moderate. This is necessary to provide the service you use (GDPR Art. 6(1)(b)).",
            "To keep Meerkat secure and working: logs, error reports and performance traces help us find and fix problems and stop abuse (our legitimate interest, Art. 6(1)(f)).",
            "To understand how Meerkat is used and improve it, through analytics and the feedback form (our legitimate interest, Art. 6(1)(f)).",
          ]}
        />
      </Section>

      <Section title="Automatic moderation">
        <Paragraph>
          An organizer can turn on automatic moderation for a conference. Each
          new question is then checked by an AI model, together with the talk's
          title, speakers and description, before it is shown. A question
          judged harmful (for example threats, explicit content, or politics
          unrelated to the conference) is shown only to its author and the
          organizers, who can restore it. No user id or email address
          is sent to the model.
        </Paragraph>
      </Section>

      <Section title="What other people see">
        <Paragraph>
          Your questions, display name and vote counts are public: anyone with
          the link to a session can see them, and they may appear on the stage
          screen and in conference apps that embed Meerkat. By tapping your
          name, signed-in attendees can see your points, how many of your
          questions were picked, how many votes you received, and your tier. Your email address is
          never shown to other attendees.
        </Paragraph>
      </Section>

      <Section title="Who receives your data">
        <Paragraph>
          We use these service providers, who process data on our behalf:
        </Paragraph>
        <Bullets
          items={[
            "Fly.io: hosting, in Frankfurt, Germany.",
            "Supabase: database and sign-in, in Frankfurt, Germany.",
            "PostHog: analytics, error tracking and logs, in the EU.",
            "Resend: sends sign-in emails.",
            "OpenRouter and the AI model provider it routes to: automatic moderation, only for conferences that use it.",
            "Google Fonts: your browser loads the fonts from Google, which sees your IP address.",
          ]}
        />
        <Paragraph>
          Some of these providers are based in the United States. Where data
          leaves the EU, it is protected by the providers' standard
          contractual clauses or an adequacy decision.
        </Paragraph>
      </Section>

      <Section title="Cookies and storage on your device">
        <Bullets
          items={[
            "Your sign-in session and a few settings of the app, kept in your browser's local storage. Meerkat needs them to work.",
            "Analytics: a cookie and local storage entries from PostHog with a pseudonymous identifier, kept for up to one year.",
          ]}
        />
      </Section>

      <Section title="How long we keep it">
        <Paragraph>
          We keep your account, questions and votes so organizers can review
          their conference, until you ask us to delete them. Logs, analytics
          and error reports are kept for a limited period and then deleted by
          our providers.
        </Paragraph>
      </Section>

      <Section title="Your rights">
        <Paragraph>
          You can ask for a copy of your data, have it corrected or deleted,
          restrict or object to its processing, and receive it in a portable
          format. Write to {CONTACT_EMAIL}. In the EU, you can also complain to
          a data protection authority.
        </Paragraph>
        <Paragraph>
          Users in India can access, correct and erase their data, nominate
          someone to exercise these rights for them, and raise a grievance with
          our Grievance Officer ({CONTACT_EMAIL}). If it is not resolved, you
          can complain to the Data Protection Board of India.
        </Paragraph>
      </Section>

      <Section title="Children">
        <Paragraph>
          Meerkat is meant for people aged 18 and over. Please don't use it if
          you are younger.
        </Paragraph>
      </Section>

      <Section title="Changes">
        <Paragraph>
          We update this policy when Meerkat changes. The date at the top shows
          the latest version.
        </Paragraph>
      </Section>
    </Box>
  );
}

function Terms() {
  return (
    <Box as="section" id="terms" display="flex" flexDirection="column" gap="6">
      <Text as="h2" fontSize="xl" fontWeight="bold">
        Terms and conditions
      </Text>
      <Paragraph>
        These terms apply to everyone who uses Meerkat, operated by{" "}
        {OPERATOR_NAME}. By using Meerkat you agree to them.
      </Paragraph>

      <Section title="Using Meerkat">
        <Paragraph>
          You must be 18 or older. You can take part anonymously, with an email
          code, or through a conference app. Some conferences are open only to
          their attendees. Keep access to your email and device to yourself:
          what happens in your account is your responsibility.
        </Paragraph>
      </Section>

      <Section title="Your questions">
        <Paragraph>
          You are responsible for what you post. You keep the rights to your
          questions and allow us and the conference organizer to show, store
          and moderate them: on the Q&A page, the stage screen, the organizer
          tools, and in conference apps that embed Meerkat.
        </Paragraph>
      </Section>

      <Section title="What you may not post">
        <Paragraph>Don't post anything that:</Paragraph>
        <Bullets
          items={[
            "is unlawful, or infringes someone else's rights, including copyright and privacy;",
            "harasses, threatens, insults or discriminates against anyone, or incites violence or hatred;",
            "is sexually explicit or harmful to children;",
            "reveals someone else's personal information without their consent;",
            "impersonates someone, or deliberately misleads;",
            "is spam, advertising, or contains malware;",
            "threatens the unity, integrity, defence, security or sovereignty of India, public order, or friendly relations with other states.",
          ]}
        />
      </Section>

      <Section title="Moderation">
        <Paragraph>
          Organizers, moderators and automatic moderation can hide or delete
          questions, and organizers and moderators can block an account from
          all conferences for 30 days, without notice. Points, tiers and supervotes have no monetary value and can
          change or end at any time.
        </Paragraph>
      </Section>

      <Section title="Complaints and removal requests">
        <Paragraph>
          To report content or raise a complaint, write to our Grievance
          Officer, {OPERATOR_NAME}, at {CONTACT_EMAIL}. We acknowledge
          complaints within 24 hours and resolve them within 15 days.
        </Paragraph>
      </Section>

      <Section title="Availability and liability">
        <Paragraph>
          Meerkat is provided as it is, without guarantees that it is always
          available or free of errors. We are liable only where the law
          requires it, in particular for intent and gross negligence.
        </Paragraph>
      </Section>

      <Section title="Changes">
        <Paragraph>
          We may change these terms; the date at the top shows the latest
          version. If you keep using Meerkat after a change, the new terms
          apply.
        </Paragraph>
      </Section>

      <Section title="Contact">
        <Paragraph>
          {OPERATOR_NAME}, {CONTACT_EMAIL}.
        </Paragraph>
      </Section>
    </Box>
  );
}

function Section(
  { title, children }: { title: string; children: React.ReactNode },
) {
  return (
    <Flex as="section" flexDirection="column" gap="3">
      <Text as="h3" fontSize="md" fontWeight="semibold">
        {title}
      </Text>
      {children}
    </Flex>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="sm" lineHeight="tall">
      {children}
    </Text>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <List.Root
      gap="2"
      paddingStart="5"
      fontSize="sm"
      lineHeight="tall"
      // Inline, because app.css resets list markers outside Chakra's layers.
      style={{ listStyleType: "disc" }}
    >
      {items.map((item, index) => <List.Item key={index}>{item}</List.Item>)}
    </List.Root>
  );
}
