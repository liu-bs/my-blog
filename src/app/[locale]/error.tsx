/**
 * @file error.tsx
 * @description locale 段错误边界：捕获子路由渲染/数据异常，展示本地化错误文案；
 *              提供重试、返回首页与一键复制错误详情（含堆栈与当前 URL）便于反馈排查
 */
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import type { ErrorBoundaryProps } from "@shared";

export default function Error({ error, retry }: ErrorBoundaryProps) {
  const t = useTranslations("errors");

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

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
          <Button onClick={retry}>{t("reload")}</Button>
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
