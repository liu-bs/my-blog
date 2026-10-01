/**
 * @file PageHeader.tsx
 * @description 页面标题头（服务端组件）：标题（字符串或自定义节点）、副标题与右侧操作区
 */
import type { PageHeaderProps } from "@shared";

/**
 * PageHeader 页面标题头
 * @param title 标题（字符串渲染为 h1，或直接传入自定义节点）
 * @param subtitle 副标题
 * @param actions 右侧操作区
 */
export function PageHeader({ title, subtitle, actions, className = "" }: PageHeaderProps) {
  return (
    <header
      className={`page-header animate-fade-in ${actions ? "page-actions" : ""} ${className}`.trim()}
    >
      <div>
        {typeof title === "string" ? (
          <h1 className="page-title max-md:page-title-mobile">{title}</h1>
        ) : (
          title
        )}

        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>

      {actions && <div className="row-md">{actions}</div>}
    </header>
  );
}
