/**
 * @file PageHeader.tsx
 * @description 页面级页头：主标题 + 可选副标题 + 可选右侧操作区，统一全站页面标题的字号与进入动画
 */
import type { PageHeaderProps } from "@shared";

/**
 * PageHeader 页面页头
 * @description title 为字符串时由组件代为渲染 h1（最大化复用标题样式与移动端尺寸）；
 *              传入节点时原样渲染，交给调用方自行控制标题层级；
 *              actions 存在时额外追加 page-actions 类，使标题区与操作区在同一行内两端对齐
 * @param props {@link PageHeaderProps}
 * @returns 页头元素
 */
export function PageHeader({ title, subtitle, actions, className = "" }: PageHeaderProps) {
  return (
    <header
      className={`page-header animate-fade-in ${actions ? "page-actions" : ""} ${className}`.trim()}
    >
      <div>
        {/* 字符串标题走内置 h1，富文本标题原样渲染 */}
        {typeof title === "string" ? (
          <h1 className="page-title max-md:page-title-mobile">{title}</h1>
        ) : (
          title
        )}
        {/* 副标题可选，仅在有内容时占位 */}
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {/* 右侧操作区插槽，如「新建」按钮 */}
      {actions && <div className="row-md">{actions}</div>}
    </header>
  );
}
