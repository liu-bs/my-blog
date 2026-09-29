/**
 * @file zh/footer.ts
 * @description 中文 - 页脚版权与标语文案
 */
const footer = {
  /**
   * 页脚版权行，含两个占位符：{site} 为站点名、{author} 为维护者名，
   * 年份为硬编码，跨年时需人工更新
   */
  copyright: "© 2026 {site} · 由 {author} 维护",
  /** 页脚品牌标语，与 meta.siteDescription 的调性保持一致 */
  tagline: "工程笔记 · 深度思考",
};

export type Messages = typeof footer;
export default footer;
