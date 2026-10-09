/**
 * @file LoginRequired.tsx
 * @description "需要登录"空态页：居中展示图标、标题与说明，并提供携带当前路径回跳参数的
 * 去登录按钮（buildLoginRedirect）。供 AuthGate 及需要登录的入口复用。
 */
"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { messages } from "@/texts";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { buildLoginRedirect } from "@/lib/url";

/**
 * LoginRequired 组件入参
 */
interface LoginRequiredProps {
  /** 空态图标元素 */
  icon: ReactNode;

  /** 场景化的说明文案 */
  description: string;
}

/**
 * 需要登录空态页
 * @param icon 空态图标
 * @param description 说明文案
 */
export function LoginRequired({ icon, description }: LoginRequiredProps) {
  // 当前路径作为登录成功后的回跳目标
  const pathname = usePathname() || "/";
  return (
    <Container className="page-section">
      {/* 空态：图标 + "需要登录"标题 + 说明 + 去登录按钮（带 redirect 参数） */}
      <EmptyState
        icon={icon}
        title={messages.common.loginRequired}
        description={description}
        action={<Button href={buildLoginRedirect(pathname)}>{messages.common.goLogin}</Button>}
      />
    </Container>
  );
}
