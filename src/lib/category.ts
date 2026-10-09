/**
 * @file category.ts
 * @description 文章分类常量：前端筛选展示的"全部"哨兵值与合法分类枚举，与服务端分类校验保持一致
 */

/** 分类筛选的"全部"展示值，非真实分类，仅用于 UI */
export const ALL_CATEGORY = "全部";

/** 合法文章分类枚举；新建帖子表单默认取第一项（技术） */
export const CATEGORY_VALUES = ["技术", "设计", "生活", "产品", "创业", "其他"] as const;
