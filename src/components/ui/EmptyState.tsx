/**
 * @file EmptyState.tsx
 * @description 通用空状态占位，用于列表无数据、搜索结果为空等场景，可挂载说明文案与操作入口
 */
import type { EmptyStateProps } from "@shared";

/**
 * EmptyState 空状态占位
 * @param props {@link EmptyStateProps}
 * @returns 空状态卡片；description 与 action 均为可选，未传时不渲染对应区块
 */
export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    // role="status" 使空态在动态出现时被读屏播报
    <div
      className={`rounded-xl border border-stroke bg-surface px-6 py-10 text-center ${className}`}
      role="status"
    >
      {/* 图标区：仅视觉装饰，语义由 title 承载 */}
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-card-bg text-faint">
        {icon}
      </div>
      {/* 主标题 */}
      <p className="mb-1.5 text-(length:--type-base) leading-normal font-semibold text-heading">
        {title}
      </p>
      {/* 补充说明，可选 */}
      {description && (
        <p className="mx-auto max-w-75 text-(length:--type-xs) leading-relaxed text-muted">
          {description}
        </p>
      )}
      {/* 行动入口（如「去写第一篇」按钮），可选 */}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
