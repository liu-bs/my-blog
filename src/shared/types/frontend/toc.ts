/**
 * @file toc.ts
 * @description 文章目录（TOC）的数据结构。目录由正文 DOM 中的 H2 / H3 标题实时提取而来，
 *              因此这里描述的是「扁平列表 + 层级标记」，而非嵌套树。
 */

/**
 * 目录条目
 * @description 每条对应正文中的一个 H2 或 H3 标题，`id` 即该标题元素的 DOM id，
 *              点击目录项即滚动到该锚点，所以 id 必须与正文标题元素的 id 完全一致。
 */
export interface TocItem {
  /** 标题元素的 DOM id（锚点），无 id 的标题会被赋予 `heading-{序号}` 兜底值 */
  id: string;

  /** 标题文本，作为目录项的展示文案 */
  text: string;

  /** 是否为次级标题：true 表示 H3，渲染时缩进一级；H2 为 false（顶层） */
  sub: boolean;
}
