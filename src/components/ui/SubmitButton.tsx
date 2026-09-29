/**
 * @file SubmitButton.tsx
 * @description 表单提交按钮，借助 useFormStatus 自动读取所在 form 的 pending 状态并驱动 loading，无需父级手动传递
 */
"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";
import type { ButtonVariant, ButtonSize } from "@shared";

/**
 * SubmitButton 组件入参
 */
interface SubmitButtonProps {
  /** 按钮文案或内容 */
  children: React.ReactNode;

  /** 追加的样式类 */
  className?: string;

  /** 按钮变体，默认 primary {@link ButtonVariant} */
  variant?: ButtonVariant;

  /** 按钮尺寸，默认 md {@link ButtonSize} */
  size?: ButtonSize;
}

/**
 * SubmitButton 提交按钮
 * @param props {@link SubmitButtonProps}
 * @returns 固定 type="submit" 的 Button，pending 期间同时置 loading 与 disabled
 * @warning useFormStatus 读取的是「最近一个父级 form」的状态，本组件必须是该 form 的直接子级才能生效
 */
export function SubmitButton({
  children,
  className = "",
  variant = "primary",
  size = "md",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    // 既传 loading 显示转圈，又传 disabled 阻止重复提交（双保险）
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
