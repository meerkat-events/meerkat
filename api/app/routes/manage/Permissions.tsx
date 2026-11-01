import { type FormEvent, type RefObject, useEffect, useRef, useState } from "react";
import {
  Button,
  CloseButton,
  Dialog,
  Field,
  Input,
  NativeSelect,
  Portal,
  Switch,
} from "@chakra-ui/react";
import { useManage } from "../../layouts/manage.tsx";
import { useAuth } from "../../hooks/use-auth.ts";
import {
  type ConferenceMember,
  type GrantableRole,
  useConferencePermissions,
} from "../../hooks/use-conference-permissions.ts";
import { useConferenceAttendees } from "../../hooks/use-conference-attendees.ts";
import { toaster } from "../../components/ui/toaster.tsx";
import { LuSearch } from "react-icons/lu";
import type { Route } from "./+types/Permissions.ts";

export const meta: Route.MetaFunction = () => [
  { title: "Permissions · Meerkat Management" },
];

const ROLES: { label: string; value: GrantableRole; description: string }[] = [
  {
    label: "Organizer",
    value: "organizer",
    description: "Can manage this event, including who has access.",
  },
  {
    label: "Moderator",
    value: "moderator",
    description: "Can moderate the Q&A from their talk picker.",
  },
  {
    label: "Attendee",
    value: "attendee",
    description: "Can only take part in the Q&A.",
  },
];

function RoleSelect(
  { label, value, disabled, size = "xs", width = "8rem", onChange }: {
    label: string;
    value: GrantableRole;
    disabled?: boolean;
    size?: "xs" | "sm";
    width?: string;
    onChange: (role: GrantableRole) => void;
  },
) {
  return (
    <NativeSelect.Root size={size} width={width} disabled={disabled}>
      <NativeSelect.Field
        aria-label={label}
        value={value}
        onChange={(ev) => onChange(ev.currentTarget.value as GrantableRole)}
      >
        {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}

/** The modal's fields; unmounted on close, so it reopens empty. */
function AddPersonForm(
  { emailRef, onAdd, onClose }: {
    emailRef: RefObject<HTMLInputElement | null>;
    onAdd: (email: string, role: GrantableRole) => Promise<"member" | "invited">;
    onClose: () => void;
  },
) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GrantableRole>("moderator");
  const [adding, setAdding] = useState(false);

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setAdding(true);
    try {
      const status = await onAdd(email, role);
      toaster.create({
        type: "success",
        title: status === "invited" ? "Invited" : "Access granted",
        description: status === "invited"
          ? "No email was sent. They get access when they first sign in with this address."
          : undefined,
        duration: 4000,
      });
      onClose();
    } catch (error) {
      toaster.create({
        title: "That didn't work",
        type: "error",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <Dialog.Body className="m-add-person-fields">
        <Field.Root required>
          <Field.Label>Email address</Field.Label>
          <Input
            ref={emailRef}
            size="sm"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(ev) => setEmail(ev.currentTarget.value)}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Role</Field.Label>
          <RoleSelect label="Role" size="sm" width="100%" value={role} onChange={setRole} />
          <Field.HelperText className="m-hint">
            {ROLES.find((option) => option.value === role)?.description}
          </Field.HelperText>
        </Field.Root>
      </Dialog.Body>
      <Dialog.Footer>
        <Button size="xs" variant="outline" type="button" whiteSpace="nowrap" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="xs"
          colorPalette="brand"
          type="submit"
          loading={adding}
          whiteSpace="nowrap"
        >
          Add
        </Button>
      </Dialog.Footer>
    </form>
  );
}

function MemberRow(
  { member, isYou, onRoleChange, onRemove }: {
    member: ConferenceMember;
    isYou: boolean;
    onRoleChange: (email: string, role: GrantableRole) => void;
    onRemove: (userId: string) => void;
  },
) {
  const address = member.email ?? "No email on this account";
  return (
    <tr>
      <td>
        <div className="title">
          {address}
          {isYou && <span className="m-you">You</span>}
        </div>
      </td>
      <td>
        <RoleSelect
          label={`Role of ${address}`}
          value={member.role}
          disabled={isYou || !member.email}
          onChange={(next) => member.email && onRoleChange(member.email, next)}
        />
      </td>
      <td className="action">
        {!isYou && (
          <Button
            size="xs"
            variant="outline"
            whiteSpace="nowrap"
            onClick={() => onRemove(member.userId)}
          >
            Remove
          </Button>
        )}
      </td>
    </tr>
  );
}

// Attendees are searched on the server, so wait for typing to pause.
const SEARCH_DELAY_MS = 300;

/** Everyone with access to the event, their roles, and who to add. */
export default function Permissions() {
  const { conferenceId, conferenceName } = useManage();
  const { session } = useAuth();
  const {
    data,
    error,
    isLoading,
    setRole,
    removeMember,
    removeInvitation,
  } = useConferencePermissions(conferenceId);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [showAttendees, setShowAttendees] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const query = search.trim().toLowerCase();
  const [attendeeSearch, setAttendeeSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setAttendeeSearch(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // A search looks through everyone, hidden attendees included.
  const attendeesShown = showAttendees || query !== "";
  const attendeeList = useConferenceAttendees(conferenceId, {
    enabled: attendeesShown,
    search: attendeeSearch,
  });

  // A role change can move someone between the two lists.
  const changeRole = async (email: string, role: GrantableRole) => {
    const status = await setRole(email, role);
    await attendeeList.mutate();
    return status;
  };
  const removeAccess = async (userId: string) => {
    await removeMember(userId);
    await attendeeList.mutate();
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toaster.create({ title: success, type: "success", duration: 1500 });
    } catch (error) {
      toaster.create({
        title: "That didn't work",
        type: "error",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };
  const onRoleChange = (email: string, role: GrantableRole) =>
    run(() => changeRole(email, role), "Role changed");
  const onRemove = (userId: string) => run(() => removeAccess(userId), "Access removed");

  const attendeeCount = data?.attendeeCount ?? 0;
  const total = (data?.members.length ?? 0) + (data?.invitations.length ?? 0) + attendeeCount;
  const matches = (person: { email: string | null; role: GrantableRole }) =>
    Boolean(person.email?.toLowerCase().includes(query)) || person.role.includes(query);
  const isVisible = (person: { email: string | null; role: GrantableRole }) =>
    query ? matches(person) : showAttendees || person.role !== "attendee";
  const members = data?.members.filter(isVisible);
  const invited = data?.invitations.filter(isVisible);
  const attendees = attendeesShown ? attendeeList.attendees : [];
  const invitedAttendees = data?.invitations
    .filter((invitation) => invitation.role === "attendee").length ?? 0;
  const hiddenAttendees = attendeeCount + invitedAttendees;
  const shown = (members?.length ?? 0) + (invited?.length ?? 0) +
    (query ? attendees.length : showAttendees ? attendeeCount : 0);
  // Only part of the matching attendees may be loaded yet.
  const shownLabel = `${shown}${query && attendeeList.hasMore ? "+" : ""}`;
  const searchingAttendees = attendeeList.isLoading || attendeeSearch !== query;

  return (
    <div className="m-permissions">
      <section className="m-card m-table" aria-label="Permissions">
        <div className="m-table-head">
          <div>
            <h2 style={{ fontSize: 16 }}>Permissions</h2>
            <span className="m-hint">
              {data
                ? query
                  ? `${shownLabel} of ${total} ${total === 1 ? "person" : "people"}`
                  : `${shown} ${shown === 1 ? "person" : "people"} at ${conferenceName}${
                    !showAttendees && hiddenAttendees > 0
                      ? ` · ${hiddenAttendees} ${hiddenAttendees === 1 ? "attendee" : "attendees"} hidden`
                      : ""
                  }`
                : isLoading
                ? "Loading…"
                : ""}
            </span>
          </div>
          <Button
            size="xs"
            colorPalette="brand"
            whiteSpace="nowrap"
            onClick={() => setAdding(true)}
          >
            Add someone
          </Button>
        </div>
        <div className="m-permissions-filters">
          <div className="m-search" role="search">
            <LuSearch size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search emails or roles"
              aria-label="Search people by email or role"
              autoComplete="off"
              value={search}
              onChange={(ev) => setSearch(ev.currentTarget.value)}
            />
          </div>
          {(hiddenAttendees > 0 || showAttendees) && (
            <Switch.Root
              size="sm"
              colorPalette="brand"
              checked={showAttendees}
              onCheckedChange={(e) => setShowAttendees(e.checked)}
            >
              <Switch.HiddenInput />
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Label whiteSpace="nowrap">Show attendees</Switch.Label>
            </Switch.Root>
          )}
        </div>
        {error
          ? <div className="m-empty">Couldn't load who has access. Try reloading the page.</div>
          : (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {members?.map((member) => (
                    <MemberRow
                      key={member.userId}
                      member={member}
                      isYou={member.userId === session?.user.id}
                      onRoleChange={onRoleChange}
                      onRemove={onRemove}
                    />
                  ))}
                  {invited?.map((invitation) => (
                    <tr key={invitation.id}>
                      <td>
                        <div className="title">{invitation.email}</div>
                        <div className="meta">Invited · hasn't signed in yet</div>
                      </td>
                      <td>
                        <RoleSelect
                          label={`Role of ${invitation.email}`}
                          value={invitation.role}
                          onChange={(next) => onRoleChange(invitation.email, next)}
                        />
                      </td>
                      <td className="action">
                        <Button
                          size="xs"
                          variant="outline"
                          whiteSpace="nowrap"
                          onClick={() =>
                            run(() => removeInvitation(invitation.id), "Invitation removed")}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {attendees.map((attendee) => (
                    <MemberRow
                      key={attendee.userId}
                      member={attendee}
                      isYou={attendee.userId === session?.user.id}
                      onRoleChange={onRoleChange}
                      onRemove={onRemove}
                    />
                  ))}
                  {attendeesShown && attendeeList.error && (
                    <tr>
                      <td colSpan={3} className="m-empty">
                        Couldn't load the attendees. Try reloading the page.
                      </td>
                    </tr>
                  )}
                  {attendeesShown && attendeeList.hasMore && (
                    <tr>
                      <td colSpan={3} className="m-load-more">
                        <Button
                          size="xs"
                          variant="outline"
                          whiteSpace="nowrap"
                          loading={attendeeList.isLoadingMore}
                          onClick={() => attendeeList.loadMore()}
                        >
                          Load more attendees
                        </Button>
                      </td>
                    </tr>
                  )}
                  {data && query && shown === 0 && !searchingAttendees && (
                    <tr>
                      <td colSpan={3} className="m-empty">No one matches “{search.trim()}”.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <Dialog.Root
        open={adding}
        onOpenChange={(e) => setAdding(e.open)}
        initialFocusEl={() => emailRef.current}
        lazyMount
        unmountOnExit
        size="sm"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content className="m-add-person">
              <Dialog.Header>
                <Dialog.Title>Add someone</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <AddPersonForm
                emailRef={emailRef}
                onAdd={changeRole}
                onClose={() => setAdding(false)}
              />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </div>
  );
}
