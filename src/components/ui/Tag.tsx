/**
 * @file Tag.tsx
 * @description 标签胶囊组件，四种配色变体（ink/ember/crimson/slate）；附带 tagVariantFor 工具按标签文本哈希稳定取色，
 * 用于文章分类/标签展示，保证同名标签在站内颜色一致
 */
import type { TagProps, TagVariant } from "@shared";

/** 标签变体到样式类名的映射，供组件与外部场景复用 */
export const tagClassFor: Record<TagVariant, string> = {
  ink: "tag-ink",
  ember: "tag-ember",
  crimson: "tag-crimson",
  slate: "tag-slate",
};

/** 尺寸档位到字号与内边距类名的映射 */
const sizeClass = {
  sm: "text-(length:--type-2xs) leading-normal px-2 py-0.5",
  md: "text-(length:--type-2xs) leading-normal px-2.5 py-0.5",
};

/**
 * 标签胶囊
 * @param props.children 标签文本内容
 * @param props.variant 配色变体，默认 ink {@link TagVariant}
 * @param props.size 尺寸档位，默认 md（sm/md）
 * @param props.className 追加到根元素的自定义类名
 */
export function Tag({ children, variant = "ink", size = "md", className = "" }: TagProps) {
  return (
    <span className={`${tagClassFor[variant]} ${sizeClass[size]} ${className}`}>{children}</span>
  );
}

/**
 * 根据标签文本哈希计算稳定的配色变体
 * @param label 标签文本（如分类名、标签名）
 * @returns 四种 {@link TagVariant} 之一，同一文本始终返回相同结果
 */
export function tagVariantFor(label: string): TagVariant {
  const variants: TagVariant[] = ["ink", "ember", "crimson", "slate"];

  /* 经典字符串哈希（djb2 变体），逐字符累积，负值取绝对值后取模映射变体 */
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % variants.length;
  return variants[index] ?? "ink";
}
