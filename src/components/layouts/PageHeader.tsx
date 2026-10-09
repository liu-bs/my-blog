/**
 * @file PageHeader.tsx
 * @description 页面头部组件，渲染标题、副标题及右侧操作按钮区；title 为字符串时用 h1.page-title 渲染，
 * 传 ReactNode 则原样输出（自定义排版场景）；用于各页面内容区顶部
 */
import type { PageHeaderProps } from "@shared";

/**
 * 页面头部
 * @param props.title 页面标题，字符串渲染为 h1，ReactNode 直接透传
 * @param props.subtitle 副标题说明文本
 * @param props.actions 右侧操作区节点（按钮组等），存在时启用 page-actions 布局
 * @param props.className 追加到 header 根元素的自定义类名
 */
export function PageHeader({ title, subtitle, actions, className = "" }: PageHeaderProps) {
  return (
    /* 头部根容器，有 actions 时追加两端对齐布局类 */
    <header
      className={`page-header animate-fade-in ${actions ? "page-actions" : ""} ${className}`.trim()}
    >
      {/* 标题与副标题区 */}
      <div>
        {typeof title === "string" ? (
          /* 字符串标题：标准 h1 样式，移动端自动缩小字号 */
          <h1 className="page-title max-md:page-title-mobile">{title}</h1>
        ) : (
          /* 自定义 ReactNode 标题：原样渲染 */
          title
        )}

        {/* 副标题说明文本 */}
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>

      {/* 右侧操作按钮区，无 actions 时不渲染 */}
      {actions && <div className="row-md">{actions}</div>}
    </header>
  );
}
