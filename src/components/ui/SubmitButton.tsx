/**
 * @file SubmitButton.tsx
 * @description 表单提交按钮：基于 useFormStatus 感知所在 form 的提交状态，提交中自动展示 Spinner 并禁用，无需手动传 loading
 */
"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";
import type { ButtonVariant, ButtonSize } from "@shared";

/**
 * SubmitButton 组件入参
 */
interface SubmitButtonProps {
  /** 按钮文案 */
  children: React.ReactNode;

  /** 附加类名 */
  className?: string;

  /** 视觉变体，默认 primary */
  variant?: ButtonVariant;

  /** 尺寸，默认 md */
  size?: ButtonSize;
}

/**
 * SubmitButton 提交按钮
 * @description 必须置于 <form> 内部才能通过 useFormStatus 感知提交状态
 * @param props {@link SubmitButtonProps} 文案与样式配置
 */
export function SubmitButton({
  children,
  className = "",
  variant = "primary",
  size = "md",
}: SubmitButtonProps) {
  /** 所在 form 的提交中状态 */
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      loading={pending}
      disabled={pending}
      variant={variant}
      size={size}
      className={className}
    >
      {children}
    </Button>
  );
}
