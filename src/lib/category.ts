/**
 * @file category.ts
 * @description 文章分类常量与工具：分类枚举值、"全部"标识、分类到 i18n 词条键的映射及显示名获取
 */

/** "全部"分类标识，非真实文章分类 */
export const ALL_CATEGORY = "全部";

/**
 * 文章分类枚举值
 */
export const CATEGORY_VALUES = ["技术", "设计", "生活", "产品", "创业", "其他"] as const;

/** 分类值联合类型 */
type CategoryValue = (typeof CATEGORY_VALUES)[number];

/**
 * 分类值到 i18n 词条键的映射
 */
export const CATEGORY_LABEL_KEYS: Record<CategoryValue, `categoryNames.${CategoryValue}`> = {
  技术: "categoryNames.技术",
  设计: "categoryNames.设计",
  生活: "categoryNames.生活",
  产品: "categoryNames.产品",
  创业: "categoryNames.创业",
  其他: "categoryNames.其他",
};

/**
 * 判断是否为合法分类值（类型守卫）
 * @param value 待判断字符串
 * @returns 是否为已知分类
 */
export function isKnownCategory(value: string): value is CategoryValue {
  return (CATEGORY_VALUES as readonly string[]).includes(value);
}

/**
 * 获取分类显示名：已知分类走 i18n 词条，未知分类原样返回
 * @param value 分类值
 * @param t i18n 翻译函数
 * @returns 显示名
 */
export function getCategoryLabel(value: string, t: (key: string) => string): string {
  return isKnownCategory(value) ? t(CATEGORY_LABEL_KEYS[value]) : value;
}
