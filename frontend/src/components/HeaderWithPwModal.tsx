import { useState } from "react";
import { Key, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import ChangePasswordModal from "./ChangePasswordModal";

/** Wraps any component, adding a key icon to its header that opens the change password modal */
export default function HeaderWithPwModal({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [show, setShow] = useState(false);

  return (
    <>
      {children}
      {/* Inject a floating key button at bottom-right */}
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-6 left-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 border border-border shadow-md hover:bg-surface-3 transition"
        title="Cambiar contraseña"
      >
        <Key className="h-4 w-4 text-text-muted" />
      </button>
      {show && <ChangePasswordModal onClose={() => setShow(false)} />}
    </>
  );
}
