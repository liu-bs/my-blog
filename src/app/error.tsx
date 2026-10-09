/**
 * @file error.tsx
 * @description 应用级错误边界页面（Error Boundary），捕获 app 路由树下所有未处理的服务端/客户端渲染错误。
 * 仅在客户端渲染（"use client"），提供重新加载、返回首页和复制错误详情（便于排查）三种操作。
 * 覆盖范围：src/app 下所有未被下层 error.tsx（如 posts/error.tsx）捕获的错误。
 */
"use client";

import { useEffect, useState } from "react";
import { messages } from "@/texts";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import type { ErrorBoundaryProps } from "@shared";

/**
 * 应用级错误兜底页
 * @param props error - 被捕获的 Error 对象（Next.js 错误边界注入）；retry - 重试渲染的回调
 */
export default function Error({ error, retry }: ErrorBoundaryProps) {
  /** 错误详情是否已复制到剪贴板（用于按钮文案反馈，2 秒后自动复位） */
  const [copied, setCopied] = useState(false);

  /**
   * 错误发生时输出到控制台，便于在浏览器/日志中定位堆栈
   */
  useEffect(() => {
    console.error(error);
  }, [error]);

  /**
   * 将错误名称、消息、堆栈及当前页面 URL 复制到剪贴板，
   * 成功后短暂显示"已复制"状态；剪贴板不可用时静默忽略
   */
  const copyError = () => {
    const text = `${error.name}: ${error.message}\n${error.stack || ""}\nURL: ${typeof window !== "undefined" ? window.location.href : ""}`;
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);

        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <Container className="page-section">
      {/* 错误提示主体：标题 + 描述文案 */}
      <div className="flex min-h-[50vh] animate-fade-in flex-col items-center justify-center text-center">
        <h1 className="mb-5 display-serif text-(length:--type-3xl) leading-tight font-bold text-heading">
          {messages.errors.errorTitle}
        </h1>
        <p className="mb-10 max-w-100 text-(length:--type-base) leading-relaxed text-muted">
          {messages.errors.errorDesc}
        </p>

        {/* 操作按钮组：重新加载 / 返回首页 / 复制错误详情 */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={retry}>{messages.errors.reload}</Button>
          <Button variant="ghost" href="/">
            {messages.errors.goHome}
          </Button>
          <Button variant="ghost" onClick={copyError}>
            {copied ? messages.errors.copied : messages.errors.copyError}
          </Button>
        </div>
      </div>
    </Container>
  );
}
