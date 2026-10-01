/**
 * @file Alert.tsx
 * @description 提示条组件，支持 info/success/warning/error 四种变体；error/warning 用 role=alert 立即播报，info/success 用 role=status 温和播报；visible 控制显隐
 */
import type { AlertProps, AlertVariant } from "@shared";

/** 提示变体 → 样式类名映射 */
const variantClass: Record<AlertVariant, string> = {
  info: "alert-info",
  success: "alert-success",
  warning: "alert-warning",
  error: "alert-error",
};

/**
 * Alert 提示条
 * @description role 语义随变体分级：error/warning 为 alert（强提醒），其余为 status
 * @param props {@link AlertProps} 变体、图标、内容与 visible 显隐开关
 */
export function Alert({ variant, icon, children, visible = true, className = "" }: AlertProps) {
  return (
    // error/warning 需立即播报用 alert，其余用 status
    <div
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
      className={`row-sm rounded-lg px-3.5 py-2.5 text-(length:--type-xs) leading-normal shadow-[inset_0_0_0_1px_var(--alert-ring)] ${variantClass[variant]} ${visible ? "flex" : "hidden"} ${className}`}
    >
      {icon && (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}

      <span>{children}</span>
    </div>
  );
}
