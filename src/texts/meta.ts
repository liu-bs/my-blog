/**
 * @file meta.ts
 * @description 站点元信息文案，用于 layout.tsx 的 metadata、manifest.ts 及 OG/RSS 输出的站点名与描述，
 * 经 messages.meta 消费。
 */

/** 站点元信息文案集合 */
const meta = {
  /** 站点名称，用于浏览器标签 title、manifest 等 */
  siteTitle: "慢半拍",

  /** 站点描述，用于 metadata description 与分享摘要兜底 */
  siteDescription: "慢半拍 · 旅行、阅读与慢下来的时刻",

  /** OG 分享图的替代文本 */
  ogImageAlt: "慢半拍",
};

/** 站点元信息文案默认导出 */
export default meta;
