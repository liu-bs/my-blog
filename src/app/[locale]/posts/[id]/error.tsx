/**
 * @file posts/[id]/error.tsx
 * @description 文章详情段的错误边界（客户端组件）。作用范围最窄，仅覆盖 /[locale]/posts/[id] 详情子树，
 * 优先级高于 posts/error.tsx；因此详情页自身的渲染异常会落到这里而不是列表段的错误边界。
 */
"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

/**
 * 详情页错误兜底 UI
 * @description 未声明 error / reset 入参，即不展示原始错误信息也不做原地重试；
 * 恢复路径是「返回文章列表」链接，靠整段导航触发一次全新的服务端渲染。
 * @returns 错误提示空态，附「返回文章列表」链接
 */
export default function PostDetailError() {
  const t = useTranslations("errors");
  return (
    <Container className="page-section">
      <div className="animate-fade-in">
        <EmptyState
          icon={<AlertCircle size={20} strokeWidth={2.5} />}
          title={t("postErrorTitle")}
          description={t("postErrorDesc")}
          action={
            <Button href="/posts" variant="ghost">
              {t("backToList")}
            </Button>
          }
        />
      </div>
    </Container>
  );
}
