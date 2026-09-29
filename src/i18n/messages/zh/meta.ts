/**
 * @file zh/meta.ts
 * @description 中文 - 站点级 SEO 元信息（用于 layout 的 metadata 与 Open Graph 标签）
 */
const meta = {
  /** 站点标题，同时作为页面标题模板的默认值 */
  siteTitle: "工程笔记",
  /** 站点描述，用于 <meta name="description"> 与 OG 描述 */
  siteDescription: "工程笔记 · 深度思考 · 极致极简",
  /** OG 分享图的 alt 文本 */
  ogImageAlt: "工程笔记",
};

export type Messages = typeof meta;
export default meta;
