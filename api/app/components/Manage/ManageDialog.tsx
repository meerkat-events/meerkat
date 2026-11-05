import { type ReactNode, useState } from "react";
import { CloseButton, Dialog, Portal } from "@chakra-ui/react";

/**
 * One dialog at a time: opening another dialog from this one (someone's
 * history from a session, a session from someone's history) closes this one
 * first and opens the other once it is gone. (A dialog opened on top of
 * another is dismissed when the one beneath it closes.)
 */
export function useDialogHandoff<Target>(
  onClose: () => void,
  openNext: (target: Target) => void,
) {
  const [open, setOpen] = useState(true);
  const [nextTarget, setNextTarget] = useState<Target | null>(null);

  const openInstead = (target: Target) => {
    setNextTarget(target);
    setOpen(false);
  };

  // One URL change either way: the next dialog's URL replaces this one's.
  const onExitComplete = () => {
    if (nextTarget !== null) openNext(nextTarget);
    else onClose();
  };

  return { open, setOpen, openInstead, onExitComplete };
}

/**
 * The box every management dialog shares. Its header stays put while the
 * body scrolls: a first row with `top` on the left and the close button on
 * the right, then `header`.
 */
export function ManageDialog(
  { handoff, className, label, top, header, children }: {
    /** From `useDialogHandoff`. */
    handoff: { open: boolean; setOpen: (open: boolean) => void; onExitComplete: () => void };
    /** Added to `m-person`. */
    className?: string;
    /** The dialog's accessible name, when it has no `Dialog.Title`. */
    label?: string;
    top?: ReactNode;
    header?: ReactNode;
    children: ReactNode;
  },
) {
  return (
    <Dialog.Root
      open={handoff.open}
      onOpenChange={(e) => handoff.setOpen(e.open)}
      onExitComplete={handoff.onExitComplete}
      size="xl"
      scrollBehavior="inside"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            className={className ? `m-person ${className}` : "m-person"}
            aria-label={label}
          >
            <Dialog.Header>
              <div className="m-dialog-top">
                {top}
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" aria-label="Close" />
                </Dialog.CloseTrigger>
              </div>
              {header}
            </Dialog.Header>
            <Dialog.Body>{children}</Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
