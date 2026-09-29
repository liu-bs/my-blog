/**
 * @file category.ts
 * @description 文章分类的取值与本地化：分类以中文作为存储值（与数据库、URL 参数一致），展示时再映射到 i18n 文案
 */

/** 「全部」筛选项的展示值；它只是列表筛选的哨兵值，不属于真实分类，不会写入数据库 */
export const ALL_CATEGORY = "全部";

/** 可选分类的固定取值，作为分类的唯一数据源；顺序即界面展示顺序 */
export const CATEGORY_VALUES = ["技术", "设计", "生活", "产品", "创业", "其他"] as const;

/** 分类取值联合类型 */
type CategoryValue = (typeof CATEGORY_VALUES)[number];

/** 分类值到 i18n 文案 key 的映射（如 技术 → categoryNames.技术），供 t() 取值 */
export const CATEGORY_LABEL_KEYS: Record<CategoryValue, `categoryNames.${CategoryValue}`> = {
  技术: "categoryNames.技术",
  设计: "categoryNames.设计",
  生活: "categoryNames.生活",
  产品: "categoryNames.产品",
  创业: "categoryNames.创业",
  其他: "categoryNames.其他",
};

/**
 * 判断字符串是否为已知分类
 * @param value 待判定的值
 * @returns 是 {@link CATEGORY_VALUES} 之一时为 true，并收窄类型
 */
export function isKnownCategory(value: string): value is CategoryValue {
  return (CATEGORY_VALUES as readonly string[]).includes(value);
}

/**
 * 获取分类的展示文案
 * @description 已知分类返回翻译后的名称，未知值（如历史脏数据）原样返回，避免显示为空
 * @param value 分类值
 * @param t next-intl 的翻译函数
 * @returns 本地化后的分类名
 */
export function getCategoryLabel(value: string, t: (key: string) => string): string {
  return isKnownCategory(value) ? t(CATEGORY_LABEL_KEYS[value]) : value;
}
