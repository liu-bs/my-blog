/**
 * @file PasswordStrength.tsx
 * @description 注册/改密时的密码强度可视化，用三格进度条与文案给出弱/中/强提示
 */

/**
 * 计算密码强度分值
 * @param pwd 明文密码
 * @returns 0-3 分：长度≥6、同时含大小写、同时含数字与符号各计 1 分；空串得 0
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
 * 强度分值与状态色的映射
 * @param score {@link getStrength} 输出的分值
 * @returns 对应的 CSS 变量色值：≤1 红、2 黄、3 绿
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
 * @param props {@link PasswordStrengthProps}
 * @returns 密码为空时返回 null（不占位），否则渲染三格强度条与强度文案
 */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  const t = useTranslations("auth");

  /** 当前密码强度分值，0-3 */
  const score = getStrength(password);
  if (!password) return null;

  /** 当前分值对应的强调色，同时作用于进度格与文案 */
  const activeColor = strengthColor(score);

  return (
    <>
      {/* 三格强度条：已达标格填充强调色，未达标格用中性描边色 */}
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
      {/* 强度文案，与进度条同色以强化语义 */}
      <span className="mt-1 block text-(length:--type-2xs)" style={{ color: activeColor }}>
        {t(score <= 1 ? "strengthWeak" : score === 2 ? "strengthMedium" : "strengthStrong")}
      </span>
    </>
  );
}
