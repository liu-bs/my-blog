/**
 * @file FormField.tsx
 * @description 表单字段外壳，负责 label 与内部控件的可访问性关联，并统一展示必填标记、校验错误与提示文案
 */
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { FormFieldProps } from "@shared";

/**
 * 递归从 children 中提取表单控件的 id，用于把 label 的 htmlFor 指向真正的输入元素
 * @param node React 子节点，可能是单个元素、数组或片段
 * @returns 找到的第一个 id；找不到时返回 undefined
 * @warning 依赖 React element 的 props 结构做静态推断，故只支持 id 直接挂在 JSX 上的写法
 */
function findControlId(node: ReactNode): string | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const id = findControlId(child);
      if (id) return id;
    }
    return undefined;
  }

  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props: { id?: string; children?: ReactNode } }).props;
    return props.id ?? findControlId(props.children);
  }
  return undefined;
}

/**
 * FormField 表单项外壳
 * @param props {@link FormFieldProps}
 * @returns label + 控件 + 错误/提示的纵向布局；error 存在时优先展示错误、隐藏 hint
 * @warning 开发环境会在 children 缺少 id 时告警，因为此时 label 无法与控件关联
 */
export function FormField({
  label,
  hint,
  error,
  required,
  className = "",
  children,
}: FormFieldProps) {
  const t = useTranslations("common");

  /** 用于 label 关联的内部控件 id，取不到则 label 无法点击聚焦 */
  const childId = findControlId(children);

  // 仅开发环境提示：生产构建下 console.warn 会被移除，避免噪音
  if (!childId && label && process.env.NODE_ENV !== "production") {
    console.warn("[FormField] 未在 children 中找到带 id 的表单控件，label 无法与其关联：", label);
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* label 通过 htmlFor 关联控件，点击文字即可聚焦输入框 */}
      <label
        htmlFor={childId}
        className="text-(length:--type-xs) leading-normal font-medium tracking-[-0.005em] text-heading"
      >
        {label}

        {/* 必填星号：aria-label 提供读屏可感知的「必填」语义 */}
        {required && (
          <span className="ml-1 text-state-error" aria-label={t("required")}>
            *
          </span>
        )}
      </label>
      {children}

      {/* 校验错误：role="alert" 让错误在出现时立即播报 */}
      {error && (
        <span role="alert" className="text-(length:--type-2xs) leading-normal text-state-error">
          {error}
        </span>
      )}

      {/* 辅助提示：与错误互斥，避免同时出现两种引导 */}
      {hint && !error && <span className="meta-text">{hint}</span>}
    </div>
  );
}
