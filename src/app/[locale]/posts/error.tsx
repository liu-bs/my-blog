/**
 * @file error.tsx
 * @description 文章列表段错误边界：列表页渲染/数据异常时展示本地化错误空态，提供返回列表页入口
 */
"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

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
