/**
 * @file PasswordStrength.tsx
 * @description 密码强度指示器：按「长度≥6 / 大小写混合 / 数字+特殊字符混合」三项计分（0-3），渲染对应数量的强度条与弱/中/强文案；密码为空时不渲染
 */
/**
 * 计算密码强度得分（0-3）
 * 规则：长度≥6 得 1 分；同时含大小写字母得 1 分；同时含数字与特殊字符得 1 分
 * @param pwd 密码明文
 * @returns 强度得分，空密码为 0
 */
function getStrength(pwd: string): number {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score += 1;
  return score;
}

/**
 * 得分 → 颜色映射：≤1 红（弱）、2 黄（中）、3 绿（强）
 * @param score 强度得分
 * @returns CSS 颜色变量值
 */
function strengthColor(score: number): string {
  if (score <= 1) return "var(--color-state-error)";
  if (score === 2) return "var(--color-state-warning)";
  return "var(--color-state-success)";
}

import { useTranslations } from "next-intl";
import type { PasswordStrengthProps } from "@shared";

/**
 * PasswordStrength 密码强度指示
 * @param props {@link PasswordStrengthProps} 当前密码明文
 */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  const t = useTranslations("auth");

  const score = getStrength(password);
  // 密码为空时不渲染强度条
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
        {t(score <= 1 ? "strengthWeak" : score === 2 ? "strengthMedium" : "strengthStrong")}
      </span>
    </>
  );
}
