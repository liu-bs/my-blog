/**
 * @file EmptyState.tsx
 * @description 空状态占位组件：图标 + 标题 + 可选描述与操作按钮，role=status 供读屏软件感知当前无内容
 */
import type { EmptyStateProps } from "@shared";

/**
 * EmptyState 空状态
 * @param props {@link EmptyStateProps} 图标、标题、描述与操作区元素
 */
export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-stroke bg-surface px-6 py-10 text-center ${className}`}
      role="status"
    >
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-card-bg text-faint">
        {icon}
      </div>

      <p className="mb-1.5 text-(length:--type-base) leading-normal font-semibold text-heading">
        {title}
      </p>

      {description && (
        <p className="mx-auto max-w-75 text-(length:--type-xs) leading-relaxed text-muted">
          {description}
        </p>
      )}

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
