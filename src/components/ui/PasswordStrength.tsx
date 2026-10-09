/**
 * @file PasswordStrength.tsx
 * @description 密码强度条组件，按长度/大小写混合/数字符号混合三个维度打分（0-3），
 * 渲染三段色条与"弱/中/强"文案；用于注册与修改密码表单的实时反馈
 */
/**
 * 计算密码强度得分
 * @param pwd 密码明文
 * @returns 0-3 分：长度>=6、大小写同时存在、数字与符号同时存在各加 1 分
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
 * 强度得分对应的进度条颜色
 * @param score {@link getStrength} 的得分
 * @returns CSS 颜色变量：<=1 红（弱）、2 黄（中）、3 绿（强）
 */
function strengthColor(score: number): string {
  if (score <= 1) return "var(--color-state-error)";
  if (score === 2) return "var(--color-state-warning)";
  return "var(--color-state-success)";
}

import { messages } from "@/texts";
import type { PasswordStrengthProps } from "@shared";

/**
 * 密码强度指示条
 * @param props.password 当前密码明文，为空时整个组件不渲染
 */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  const score = getStrength(password);

  if (!password) return null;

  const activeColor = strengthColor(score);

  return (
    <>
      {/* 三段式强度进度条：得分对应的前 score 段填充 activeColor，其余为描边底色 */}
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

      {/* 强度等级文案：1 分及以下为弱，2 分为中，3 分为强 */}
      <span className="mt-1 block text-(length:--type-2xs)" style={{ color: activeColor }}>
        {
          messages.auth[
            score <= 1 ? "strengthWeak" : score === 2 ? "strengthMedium" : "strengthStrong"
          ]
        }
      </span>
    </>
  );
}
