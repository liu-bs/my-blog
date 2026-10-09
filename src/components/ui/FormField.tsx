/**
 * @file FormField.tsx
 * @description 表单字段布局组件，纵向排列 label、控件、错误信息与提示文本；自动从 children 中查找带 id 的控件建立
 * htmlFor 关联，用于登录、注册、文章编辑等所有表单页的字段容器
 */
import { messages } from "@/texts";
import type { ReactNode } from "react";
import type { FormFieldProps } from "@shared";

/**
 * 递归查找 React 子树中第一个带 id 属性的表单控件
 * @param node 待遍历的 children 节点（可能为数组、元素或原始值）
 * @returns 找到的控件 id，未找到返回 undefined
 */
function findControlId(node: ReactNode): string | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const id = findControlId(child);
      if (id) return id;
    }
    return undefined;
  }

  /* 元素节点优先取自身 props.id，否则继续深入其 children 查找 */
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props: { id?: string; children?: ReactNode } }).props;
    return props.id ?? findControlId(props.children);
  }
  return undefined;
}

/**
 * 表单字段容器
 * @param props.label 字段标签文本，自动关联 children 中带 id 的控件
 * @param props.hint 辅助提示文本，仅在无 error 时显示
 * @param props.error 错误提示文本，显示时替换 hint 并带 role=alert
 * @param props.required 是否必填，true 时 label 后追加红色 * 号
 * @param props.className 追加到根容器的自定义类名
 * @param props.children 表单控件节点（Input/Select 等）
 * @warning children 中的控件必须显式带 id，否则 label 无法点击聚焦；开发环境会在控制台输出警告
 */
export function FormField({
  label,
  hint,
  error,
  required,
  className = "",
  children,
}: FormFieldProps) {
  /* 从 children 中递归探测控件 id，用于 label 的 htmlFor 关联 */
  const childId = findControlId(children);

  if (!childId && label && process.env.NODE_ENV !== "production") {
    console.error("[FormField] 未在 children 中找到带 id 的表单控件，label 无法与其关联：", label);
  }

  return (
    /* 字段纵向布局容器：label → 控件 → 错误/提示 */
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* 字段标签，必填时后缀红色 * 号 */}
      <label
        htmlFor={childId}
        className="text-(length:--type-xs) leading-normal font-medium tracking-[-0.005em] text-heading"
      >
        {label}

        {required && (
          <span className="ml-1 text-state-error" aria-label={messages.common.required}>
            *
          </span>
        )}
      </label>

      {/* 表单控件本体 */}
      {children}

      {/* 错误提示，role=alert 使读屏即时播报 */}
      {error && (
        <span role="alert" className="text-(length:--type-2xs) leading-normal text-state-error">
          {error}
        </span>
      )}

      {/* 辅助提示文本，错误存在时让位给 error */}
      {hint && !error && <span className="meta-text">{hint}</span>}
    </div>
  );
}
