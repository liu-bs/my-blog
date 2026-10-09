/**
 * @file EmptyState.tsx
 * @description 空状态占位组件，居中展示图标、标题、可选描述与操作按钮；用于列表无数据、搜索无结果、评论区空白等场景
 */
import type { EmptyStateProps } from "@shared";

/**
 * 空状态占位块
 * @param props.icon 顶部装饰图标节点
 * @param props.title 主标题文本
 * @param props.description 可选补充描述文本
 * @param props.action 可选操作区节点（按钮/链接等）
 * @param props.className 追加到根卡片的自定义类名
 */
export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    /* 外层卡片容器，role=status 使动态内容变化可被读屏播报 */
    <div
      className={`rounded-xl border border-stroke bg-surface px-6 py-10 text-center ${className}`}
      role="status"
    >
      {/* 顶部图标区 */}
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-card-bg text-faint">
        {icon}
      </div>

      {/* 主标题 */}
      <p className="mb-1.5 text-(length:--type-base) leading-normal font-semibold text-heading">
        {title}
      </p>

      {/* 可选描述文本，无 description 时不渲染 */}
      {description && (
        <p className="mx-auto max-w-75 text-(length:--type-xs) leading-relaxed text-muted">
          {description}
        </p>
      )}

      {/* 可选操作按钮区，无 action 时不渲染 */}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
