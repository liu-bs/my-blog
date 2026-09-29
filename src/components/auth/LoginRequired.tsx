/**
 * @file LoginRequired.tsx
 * @description 「需要登录」占位页：统一的空状态提示 + 登录入口，并把当前路径编码进 redirect 参数，
 *              使登录成功后能回到用户原本想访问的位置
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
  /** 空状态图标节点，由调用方决定（如 UserCircle / Lock） */
  icon: ReactNode;

  /** 补充说明文案，用于区分「控制台需登录」等不同场景，标题由组件内部固定 */
  description: string;
}

/**
 * LoginRequired 未登录占位块
 * @description 使用 i18n 感知的 usePathname 取当前路径（已去掉语言前缀），
 *              再由 buildLoginRedirect 拼成 `/login?redirect=...`，从而在登录后精确回跳
 * @param props {@link LoginRequiredProps}
 * @returns 居中的空状态卡片与登录按钮
 */
export function LoginRequired({ icon, description }: LoginRequiredProps) {
  /** 当前路径（不含语言前缀）；pathname 为空时兜底为首页 */
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
