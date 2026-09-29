/**
 * @file [locale]/error.tsx
 * @description 语言分段内的错误边界（客户端组件）。被根 layout 包裹渲染，因此可正常使用 next-intl 与全站样式组件；提供重试、回首页与复制错误信息
 */
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import type { ErrorBoundaryProps } from "@shared";

/**
 * Error 语言分段错误页
 * @param props {@link ErrorBoundaryProps}
 * @description 与 global-error 的区别：这里仍处于根 layout 之内，能使用 next-intl 与 Tailwind 组件；因此只负责呈现，不渲染 html/body
 * @param props.error 触发的错误对象
 * @param props.reset 由 Next.js 注入的重试函数
 */
export default function Error({ error, reset }: ErrorBoundaryProps) {
  const t = useTranslations("errors");

  /** 错误信息是否已复制成功，用于切换按钮文案并在 2 秒后复位 */
  const [copied, setCopied] = useState(false);

  /** 记录错误，便于排查 */
  useEffect(() => {
    console.error(error);
  }, [error]);

  /**
   * 复制错误详情（名称、消息、堆栈、当前 URL）到剪贴板
   * @description 剪贴板 API 可能不存在或被拒绝，失败时静默忽略；成功后临时提示已复制
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
      <div className="flex min-h-[50vh] animate-fade-in flex-col items-center justify-center text-center">
        <h1 className="mb-5 display-serif text-(length:--type-3xl) leading-tight font-bold text-heading">
          {t("errorTitle")}
        </h1>
        <p className="mb-10 max-w-100 text-(length:--type-base) leading-relaxed text-muted">
          {t("errorDesc")}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>{t("reload")}</Button>
          <Button variant="ghost" href="/">
            {t("goHome")}
          </Button>
          <Button variant="ghost" onClick={copyError}>
            {copied ? t("copied") : t("copyError")}
          </Button>
        </div>
      </div>
    </Container>
  );
}
