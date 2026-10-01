/**
 * @file Tag.tsx
 * @description 标签组件，支持 ink/ember/crimson/slate 四种配色与两种尺寸；tagVariantFor 根据文本哈希稳定分配配色，保证同一标签文案始终同色
 */
import type { TagProps, TagVariant } from "@shared";

/** 标签变体 → 样式类名映射 */
export const tagClassFor: Record<TagVariant, string> = {
  ink: "tag-ink",
  ember: "tag-ember",
  crimson: "tag-crimson",
  slate: "tag-slate",
};

/** 尺寸 → 样式类名映射 */
const sizeClass = {
  sm: "text-(length:--type-2xs) leading-normal px-2 py-0.5",
  md: "text-(length:--type-2xs) leading-normal px-2.5 py-0.5",
};

/**
 * Tag 标签
 * @param props {@link TagProps} 配色变体、尺寸与标签内容
 */
export function Tag({ children, variant = "ink", size = "md", className = "" }: TagProps) {
  return (
    <span className={`${tagClassFor[variant]} ${sizeClass[size]} ${className}`}>{children}</span>
  );
}

/**
 * 根据标签文本稳定分配配色变体
 * 对文本做逐字符哈希后取模，同一文案总是得到同一颜色
 * @param label 标签文本
 * @returns 配色变体 {@link TagVariant}
 */
export function tagVariantFor(label: string): TagVariant {
  const variants: TagVariant[] = ["ink", "ember", "crimson", "slate"];

  // 逐字符累加计算字符串哈希（类似 Java hashCode）
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % variants.length;
  return variants[index] ?? "ink";
}
