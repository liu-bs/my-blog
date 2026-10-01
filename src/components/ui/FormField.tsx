/**
 * @file FormField.tsx
 * @description 表单字段容器：递归查找 children 中带 id 的控件与 label 建立 htmlFor 关联；必填显示星号（带读屏文案）；error 优先展示（role=alert），无错误时展示 hint
 */
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { FormFieldProps } from "@shared";

/**
 * 递归遍历 children 查找第一个带 id 的表单控件
 * @param node 待遍历的 React 节点（可能是数组或嵌套元素）
 * @returns 控件 id，未找到返回 undefined
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
 * FormField 表单字段容器
 * @description 错误优先级：error > hint；error 用 role=alert 供读屏立即播报
 * @param props {@link FormFieldProps} 标签、提示、错误文案与表单控件
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

  /** children 中第一个带 id 的控件 id，用于 label 的 htmlFor 关联 */
  const childId = findControlId(children);

  // 开发环境兜底提示：找不到控件 id 时 label 无法与控件关联
  if (!childId && label && process.env.NODE_ENV !== "production") {
    console.warn("[FormField] 未在 children 中找到带 id 的表单控件，label 无法与其关联：", label);
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label
        htmlFor={childId}
        className="text-(length:--type-xs) leading-normal font-medium tracking-[-0.005em] text-heading"
      >
        {label}

        {/* 必填星号，aria-label 提供读屏文案 */}
        {required && (
          <span className="ml-1 text-state-error" aria-label={t("required")}>
            *
          </span>
        )}
      </label>
      {children}

      {/* 错误文案：role=alert 立即播报，优先于 hint 展示 */}
      {error && (
        <span role="alert" className="text-(length:--type-2xs) leading-normal text-state-error">
          {error}
        </span>
      )}

      {/* 无错误时展示辅助说明 */}
      {hint && !error && <span className="meta-text">{hint}</span>}
    </div>
  );
}
