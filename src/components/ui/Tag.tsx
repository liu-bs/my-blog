/**
 * @file Tag.tsx
 * @description 标签/徽章组件，既可按 variant 渲染固定色，也可按标签文本自动散列出稳定的配色
 */
import type { TagProps, TagVariant } from "@shared";

/** variant 到标签配色类的映射；对外导出供需要与 Tag 保持同色的场景复用 */
export const tagClassFor: Record<TagVariant, string> = {
  ink: "tag-ink",
  ember: "tag-ember",
  crimson: "tag-crimson",
  slate: "tag-slate",
};

/** size 到字号与内边距样式类的映射 */
const sizeClass = {
  sm: "text-(length:--type-2xs) leading-normal px-2 py-0.5",
  md: "text-(length:--type-2xs) leading-normal px-2.5 py-0.5",
};

/**
 * Tag 标签
 * @param props {@link TagProps}
 * @returns 内联的标签元素，variant 与 size 均带默认值
 */
export function Tag({ children, variant = "ink", size = "md", className = "" }: TagProps) {
  return (
    <span className={`${tagClassFor[variant]} ${sizeClass[size]} ${className}`}>{children}</span>
  );
}

/**
 * 按标签文本推导稳定的配色变体
 * @param label 标签文本
 * @returns 由文本哈希取模得到的 {@link TagVariant}
 * @description 同一文本始终得到同一颜色，保证同一标签在不同页面视觉一致，无需后端存储配色
 */
export function tagVariantFor(label: string): TagVariant {
  const variants: TagVariant[] = ["ink", "ember", "crimson", "slate"];
  /** 逐字符计算的哈希，配合 <<5 位移减少短文本碰撞 */
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  /** 取绝对值后取模，避免负数下标 */
  const index = Math.abs(hash) % variants.length;
  return variants[index] ?? "ink";
}
