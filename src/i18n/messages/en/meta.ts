/**
 * @file en/meta.ts
 * @description 英文 - 站点级 SEO 元信息（用于 layout 的 metadata 与 Open Graph 标签），与 zh/meta.ts 逐 key 对应
 */
import type { Messages } from "../zh/meta";

const meta: Messages = {
  /** 站点标题，同时作为页面标题模板的默认值 */
  siteTitle: "Engineering Notes",
  /** 站点描述，用于 <meta name="description"> 与 OG 描述 */
  siteDescription: "Engineering notes · Deep thinking · Minimalist",
  /** OG 分享图的 alt 文本 */
  ogImageAlt: "Engineering Notes",
};

export default meta;
