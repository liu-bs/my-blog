import { messages } from "@/texts";
import type { ReactNode } from "react";
import type { FormFieldProps } from "@shared";

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

export function FormField({
  label,
  hint,
  error,
  required,
  className = "",
  children,
}: FormFieldProps) {

  const childId = findControlId(children);

  if (!childId && label && process.env.NODE_ENV !== "production") {
    console.error("[FormField] 未在 children 中找到带 id 的表单控件，label 无法与其关联：", label);
  }

  return (

    <div className={`flex flex-col gap-2 ${className}`}>

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

      {children}

      {error && (
        <span role="alert" className="text-(length:--type-2xs) leading-normal text-state-error">
          {error}
        </span>
      )}

      {hint && !error && <span className="meta-text">{hint}</span>}
    </div>
  );
}
