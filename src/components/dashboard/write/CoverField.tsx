/**
 * @file CoverField.tsx
 * @description 文章封面 URL 输入与预览：URL 经 isSafeImageUrl 白名单校验（提交前的唯一校验口，
 *              渲染层直接走 next/image 优化器）；合法 URL 防抖 500ms 后展示小图预览，加载失败提示；
 *              失焦后才提示格式错误，避免输入过程打扰
 */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { isSafeImageUrl } from "@shared";
import { PREVIEW_DEBOUNCE_MS } from "./MarkdownPane";

/**
 * 封面 URL 安全校验：允许为空，非空必须通过 isSafeImageUrl 白名单（协议/域名限制）
 * @param value 输入的封面 URL
 * @returns 是否允许使用
 */
export function isCoverUrlAllowed(value: string): boolean {
  const url = value.trim();
  return url === "" || isSafeImageUrl(url);
}

/**
 * CoverField 封面输入与预览
 * @param value 封面 URL
 * @param onChange URL 变更回调
 * @param error 外部（提交时）注入的错误文案
 */
export function CoverField({
  value,
  onChange,
  error,
}: {
  /** 封面 URL */
  value: string;

  /** URL 变更回调 */
  onChange: (value: string) => void;

  /** 外部注入的错误文案 */
  error?: string;
}) {
  const t = useTranslations("write");

  /** 是否失焦过：失焦后才展示格式错误 */
  const [touched, setTouched] = useState(false);

  /** 防抖后的预览图地址（空表示不预览） */
  const [previewSrc, setPreviewSrc] = useState("");

  /** 预览图加载失败标记 */
  const [previewFailed, setPreviewFailed] = useState(false);

  /** 当前 URL 是否通过安全校验 */
  const allowed = isCoverUrlAllowed(value);

  const url = value.trim();

  /** 合法 URL 防抖 500ms 后更新预览；清空或非法时重置预览状态 */
  useEffect(() => {
    if (url === "" || !allowed) {
      setPreviewSrc("");
      setPreviewFailed(false);
      return;
    }
    const timer = setTimeout(() => {
      setPreviewSrc(url);
      setPreviewFailed(false);
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [url, allowed]);

  /** 展示的错误：优先提交注入错误，其次失焦后的实时校验错误 */
  const shownError = error ?? (touched && !allowed ? t("coverInvalid") : undefined);

  return (
    <FormField
      label={t("coverLabel")}
      hint={previewFailed ? t("coverPreviewFailed") : t("coverHint")}
      error={shownError}
    >
      <div className="row-sm">
        <Input
          id="cover-image"
          name="coverImage"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://example.com/cover.jpg"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.replace(/\s+/g, ""));
          }}

          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          onFocus={() => setTouched(false)}
          onBlur={() => setTouched(true)}
          error={!!shownError}
          className="flex-1"
        />

        {previewSrc !== "" && !previewFailed && (
          <div className="shrink-0 overflow-hidden rounded-md border border-stroke-strong">
            <Image
              src={previewSrc}
              alt={t("coverPreview")}
              width={40}
              height={40}
              onError={() => setPreviewFailed(true)}
              className="h-10 w-10 object-cover"
            />
          </div>
        )}
      </div>
    </FormField>
  );
}
