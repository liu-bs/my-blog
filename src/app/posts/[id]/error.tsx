/**
 * @file error.tsx
 * @description 文章详情段（/posts/[id]）的错误边界页，捕获该路由段内渲染错误，
 * 优先于应用级 error.tsx 生效；以空态卡片提示并提供返回列表页入口。
 */
"use client";

import { AlertCircle } from "lucide-react";
import { messages } from "@/texts";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

/**
 * 详情段错误兜底页（注：本实现未接收 error/retry props，仅提供返回列表链接）
 */
export default function PostDetailError() {
  return (
    <Container className="page-section">
      {/* 错误提示空态：告警图标 + 标题 + 描述 + 返回列表按钮 */}
      <div className="animate-fade-in">
        <EmptyState
          icon={<AlertCircle size={20} strokeWidth={2.5} />}
          title={messages.errors.postErrorTitle}
          description={messages.errors.postErrorDesc}
          action={
            <Button href="/posts" variant="ghost">
              {messages.errors.backToList}
            </Button>
          }
        />
      </div>
    </Container>
  );
}
