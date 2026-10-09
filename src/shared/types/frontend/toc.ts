/**
 * @file toc.ts
 * @description 文章目录（Table of Contents）条目类型，由 PostToc 组件在浏览器端扫描
 *              文章正文标题后生成，用于侧边锚点导航渲染。
 */

/**
 * 目录中的单个锚点条目
 */
export interface TocItem {
  /** 标题元素的 DOM id，作为锚点跳转目标 */
  id: string;

  /** 标题显示文本 */
  text: string;

  /** 是否为子级标题：true-次级（如 h3，缩进展示），false-一级（如 h2） */
  sub: boolean;
}
