/**
 * @file posts/error.tsx
 * @description /posts 分段的错误边界（客户端组件）。覆盖面比 posts/[id]/error.tsx 更广：
 * 除详情页之外的所有 /posts 子孙路由（含 (list) 列表页）都由此兜底，详情段则优先命中更近的错误边界。
 */
"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

/**
 * 文章列表段错误兜底 UI
 * @description 未声明 error / reset 入参，即不展示原始错误信息也不做原地重试；
 * 恢复路径是「重新加载」链接回到 /posts，同样借助导航触发整段服务端重新渲染。
 * @returns 错误提示空态，附回到列表页的按钮
 */
export default function PostsError() {
  const t = useTranslations("errors");
  return (
    <Container className="page-section">
      <div className="animate-fade-in">
        <EmptyState
          icon={<Search size={20} strokeWidth={2.5} />}
          title={t("postsErrorTitle")}
          description={t("postsErrorDesc")}
          action={
            <Button href="/posts" variant="ghost">
              {t("reload")}
            </Button>
          }
        />
      </div>
    </Container>
  );
}
