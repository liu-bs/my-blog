/**
 * @file toc.ts
 * @description 文章目录（TOC）条目类型：由 Markdown 标题解析生成的目录数据
 */

/**
 * 目录条目
 */
export interface TocItem {
  /** 对应标题的锚点 ID（heading slug），用于滚动定位 */
  id: string;

  /** 标题文本 */
  text: string;

  /** 是否为二级标题（h2 以外的下级标题，目录中缩进展示） */
  sub: boolean;
}
