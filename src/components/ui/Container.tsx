import type { ContainerProps } from "@shared";

export function Container({ children, className = "" }: ContainerProps) {
  return <div className={`container mx-auto px-4 sm:px-6 ${className}`}>{children}</div>;
}
