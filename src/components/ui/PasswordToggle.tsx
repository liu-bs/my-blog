import { Eye, EyeOff } from "lucide-react";
import auth from "@/texts/auth";

interface PasswordToggleProps {
  show: boolean;

  onToggle: (show: boolean) => void;
}

export function PasswordToggle({ show, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!show)}
      aria-label={show ? auth.hidePassword : auth.showPassword}
      className="password-toggle"
    >
      {show ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
    </button>
  );
}
