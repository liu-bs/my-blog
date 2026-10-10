import { Eye, EyeOff } from "lucide-react";
import { texts } from "@/texts";

interface PasswordToggleProps {

  show: boolean;

  onToggle: (show: boolean) => void;
}

export function PasswordToggle({ show, onToggle }: PasswordToggleProps) {
  return (

    <button
      type="button"
      onClick={() => onToggle(!show)}
      aria-label={show ? texts.auth.hidePassword : texts.auth.showPassword}
      className="password-toggle"
    >

      {show ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
    </button>
  );
}
