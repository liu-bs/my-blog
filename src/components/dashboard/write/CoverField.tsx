/**
 * @file CoverField.tsx
 * @description 封面图 URL 表单字段：输入封面地址并做安全校验，去抖后在输入框旁展示 40x40 缩略预览
 * @usage 客户端组件，用于写作页封面区；依赖 isSafeImageUrl 校验白名单，空串视为合法（可选字段）
 */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { messages } from "@/texts";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { isSafeImageUrl } from "@shared";
import { isOptimizableImageSrc } from "@/lib/url";
import { PREVIEW_DEBOUNCE_MS } from "./MarkdownPane";

/**
 * 判断封面 URL 是否允许：空值（可选）或通过安全图片校验的地址均合法
 * @param value 用户输入的封面地址
 * @returns 是否允许
 */
export function isCoverUrlAllowed(value: string): boolean {
  const url = value.trim();
  return url === "" || isSafeImageUrl(url);
}

/**
 * 封面图 URL 输入字段
 * @param props.value 当前封面地址
 * @param props.onChange 地址变更回调（已去除空白字符）
 * @param props.error 外部传入的字段错误信息
 * @returns 含缩略预览与错误提示的表单字段
 */
export function CoverField({
  value,
  onChange,
  error,
}: {
  /** 当前封面地址 */
  value: string;

  /** 地址变更回调 */
  onChange: (value: string) => void;

  /** 外部错误信息 */
  error?: string;
}) {
  /** 输入框是否失焦（用于决定是否展示本地校验错误） */
  const [touched, setTouched] = useState(false);

  /** 当前用于渲染缩略预览的地址（去抖后写入） */
  const [previewSrc, setPreviewSrc] = useState("");

  /** 缩略预览图片是否加载失败 */
  const [previewFailed, setPreviewFailed] = useState(false);

  /** 当前地址是否通过合法性校验 */
  const allowed = isCoverUrlAllowed(value);

  /** 去除首尾空白后的地址，作为去抖预览的依赖项 */
  const url = value.trim();

  /**
   * 地址合法且非空时，去抖更新预览源并重置失败标记；否则清空预览
   */
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

  /** 最终展示的错误：外部错误优先，否则失焦且非法时给出本地提示 */
  const shownError = error ?? (touched && !allowed ? messages.write.coverInvalid : undefined);

  return (
    <FormField
      label={messages.write.coverLabel}
      hint={previewFailed ? messages.write.coverPreviewFailed : messages.write.coverHint}
      error={shownError}
    >
      <div className="row-sm">
        {/* 封面地址输入框：粘贴时去除空白，回车不提交表单 */}
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

        {/* 合法地址去抖后展示的 40x40 缩略预览，加载失败则隐藏 */}
        {previewSrc !== "" && !previewFailed && (
          <div className="shrink-0 overflow-hidden rounded-md border border-stroke-strong">
            <Image
              src={previewSrc}
              alt={messages.write.coverPreview}
              width={40}
              height={40}
              unoptimized={!isOptimizableImageSrc(previewSrc)}
              onError={() => setPreviewFailed(true)}
              className="h-10 w-10 object-cover"
            />
          </div>
        )}
      </div>
    </FormField>
  );
}
