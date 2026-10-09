/**
 * @file SubmitButton.tsx
 * @description 表单提交按钮组件，通过 useFormStatus 感知所在 form 的 Server Action 提交状态，自动进入 loading/禁用态；
 * 必须放在包含 action 的 <form> 内部使用，用于登录、注册、发文等表单提交场景
 */
"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";
import type { ButtonVariant, ButtonSize } from "@shared";

/** SubmitButton 组件入参 */
interface SubmitButtonProps {
  /** 按钮文本或内容 */
  children: React.ReactNode;

  /** 追加到按钮根元素的自定义类名 */
  className?: string;

  /** 按钮变体，透传给 Button，默认 primary */
  variant?: ButtonVariant;

  /** 按钮尺寸，透传给 Button，默认 md */
  size?: ButtonSize;
}

/**
 * 表单提交按钮
 * @param props {@link SubmitButtonProps}
 * @warning 依赖 useFormStatus，只有在 <form> 子树内才能取到 pending 状态；同一表单会一起进入 pending
 */
export function SubmitButton({
  children,
  className = "",
  variant = "primary",
  size = "md",
}: SubmitButtonProps) {
  /* 所在 form 提交期间 pending 为 true，复用 Button 的 loading 态 */
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
