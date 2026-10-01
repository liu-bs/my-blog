import type { EmptyStateProps } from "@shared";

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
