import { useContext } from "react";
import { UserContext } from "../../context/user.tsx";
import { Modal } from "../Modal/Modal.tsx";

export function CooldownModal() {
  const { isOnCooldown, setIsOnCooldown } = useContext(UserContext);

  return (
    <Modal
      isOpen={isOnCooldown}
      onClose={() => {
        setIsOnCooldown(false);
      }}
      title="Cooldown 🧊"
    >
      <p>You were too fast! You are on cooldown.</p>
    </Modal>
  );
}
