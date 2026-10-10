function getStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function strengthColor(score: number): string {
  if (score <= 1) return "var(--color-state-error)";
  if (score === 2) return "var(--color-state-warning)";
  return "var(--color-state-success)";
}

import { texts } from "@/texts";
import type { PasswordStrengthProps } from "@shared";

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const score = getStrength(password);

  if (!password) return null;

  const activeColor = strengthColor(score);

  return (
    <>
      <div className="mt-2 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-xs transition-colors duration-[var(--duration-fast)] ease-smooth"
            style={{
              background: i < score ? activeColor : "var(--color-stroke)",
            }}
          />
        ))}
      </div>

      <span className="mt-1 block text-(length:--type-2xs)" style={{ color: activeColor }}>
        {
          texts.auth[
            score <= 1 ? "strengthWeak" : score === 2 ? "strengthMedium" : "strengthStrong"
          ]
        }
      </span>
    </>
  );
}
