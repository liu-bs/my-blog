/**
 * @file error.tsx
 * @description 文章列表段（/posts）的错误边界页，捕获该路由段内页面/加载态渲染错误，
 * 优先于应用级 error.tsx 生效；以空态卡片提示并提供重新加载入口。
 */
"use client";

import { Search } from "lucide-react";
import { messages } from "@/texts";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

/**
 * 列表段错误兜底页（注：本实现未接收 error/retry props，仅提供重新加载链接）
 */
export default function PostsError() {
  return (
    <Container className="page-section">
      {/* 错误提示空态：图标 + 标题 + 描述 + 重新加载按钮（链接回 /posts） */}
      <div className="animate-fade-in">
        <EmptyState
          icon={<Search size={20} strokeWidth={2.5} />}
          title={messages.errors.postsErrorTitle}
          description={messages.errors.postsErrorDesc}
          action={
            <Button href="/posts" variant="ghost">
              {messages.errors.reload}
            </Button>
          }
        />
      </div>
    </Container>
  );
}
