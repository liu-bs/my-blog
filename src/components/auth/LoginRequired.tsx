/**
 * @file LoginRequired.tsx
 * @description 未登录占位组件：EmptyState 展示「需要登录」提示，按钮携带当前路径跳转登录页（登录成功后回跳）
 */
"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { buildLoginRedirect } from "@/lib/url";

/**
 * LoginRequired 组件入参
 */
interface LoginRequiredProps {
  /** 提示区图标 */
  icon: ReactNode;

  /** 提示描述文案 */
  description: string;
}

/**
 * LoginRequired 未登录引导页
 * @param props {@link LoginRequiredProps} 图标与描述文案
 */
export function LoginRequired({ icon, description }: LoginRequiredProps) {
  /** 当前路径（兜底 "/"），作为登录成功后的回跳目标 */
  const pathname = usePathname() || "/";
  const t = useTranslations("common");
  return (
    <Container className="page-section">
      <EmptyState
        icon={icon}
        title={t("loginRequired")}
        description={description}
        action={<Button href={buildLoginRedirect(pathname)}>{t("goLogin")}</Button>}
      />
    </Container>
  );
}
