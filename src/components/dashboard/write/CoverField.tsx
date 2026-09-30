/**
 * @file CoverField.tsx
 * @description 文章封面地址输入控件：受控输入 + 防抖缩略图预览，校验复用共享层的安全图片地址白名单
 * @warning 校验逻辑必须与共享层的 optionalImageUrlSchema 保持一致，否则会出现「前端显示合法、提交却被服务端驳回」的体验割裂
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
 * 判断封面地址是否可被接受
 * @description 空串代表「未填写封面」，交由后端按可选字段处理；非空时必须是安全图片地址（站内绝对路径或 https 绝对 URL），
 *              以此拦截 javascript: 等伪协议与 // 开头的协议相对地址，防止 XSS 与外链劫持
 * @param value 用户输入的原始封面地址，允许含首尾空白
 * @returns 合法返回 true，非法返回 false
 */
export function isCoverUrlAllowed(value: string): boolean {
  const url = value.trim();
  return url === "" || isSafeImageUrl(url);
}

/**
 * CoverField 封面地址输入框
 * @description 受控组件，自身不持有最终表单值；内部只缓存「是否已离焦」与预览态。
 *              地址通过安全校验后需等待 {@link PREVIEW_DEBOUNCE_MS} 毫秒静默期才真正替换预览图，
 *              避免用户逐字符输入时向同一图片地址反复发起请求
 * @param props 组件入参，字段含义见下方内联类型注释
 * @param props.value 封面地址受控值，由父级表单持有
 * @param props.onChange 地址变更回调，回传的是已剔除全部空白字符的新地址
 * @param props.error 父级（提交阶段）下发的错误文案，展示优先级高于本地格式校验提示
 * @returns 带标签、提示与错误态的输入行；地址合法且图片加载成功时在其右侧附带缩略图预览
 */
export function CoverField({
  value,
  onChange,
  error,
}: {
  /** 封面地址受控值 */
  value: string;
  /** 地址变更回调，仅回传清洗后的新地址 */
  onChange: (value: string) => void;
  /** 外部（提交阶段）注入的错误文案 */
  error?: string;
}) {
  const t = useTranslations("write");

  /** 输入框是否已离焦；未离焦时不展示本地校验错误，避免用户刚敲第一个字符就被报错打断 */
  const [touched, setTouched] = useState(false);

  /** 防抖确认后用于渲染预览图的地址；空串表示当前不展示预览 */
  const [previewSrc, setPreviewSrc] = useState("");

  /** 预览图是否加载失败；失败后不再继续尝试渲染图片，仅保留文字提示 */
  const [previewFailed, setPreviewFailed] = useState(false);

  /** 当前输入是否通过安全校验 */
  const allowed = isCoverUrlAllowed(value);
  /** 去除首尾空白后的地址，作为预览与后续提交的最终值 */
  const url = value.trim();

  /**
   * 地址变化后防抖刷新预览
   * @description 清空或非法时立即清空预览、不等防抖，让错误状态零延迟反馈；
   *              合法地址则重置计时器，仅在停止输入 {@link PREVIEW_DEBOUNCE_MS} 毫秒后才落地为新预览地址
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

  /** 最终展示的错误文案：外部错误优先，其次才是离焦后的本地格式校验错误 */
  const shownError = error ?? (touched && !allowed ? t("coverInvalid") : undefined);

  return (
    <FormField
      label={t("coverLabel")}
      hint={previewFailed ? t("coverPreviewFailed") : t("coverHint")}
      error={shownError}
    >
      {/* 左侧地址输入 + 右侧即时预览，窄容器下自动换行 */}
      <div className="row-sm">
        {/* 输入期间剔除全部空白字符，避免复制粘贴带入空格或换行导致校验失败 */}
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
          onFocus={() => setTouched(false)}
          onBlur={() => setTouched(true)}
          error={!!shownError}
          className="flex-1"
        />

        {/* 预览缩略图：仅在地址合法、防抖已生效且图片未加载失败时出现 */}
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
