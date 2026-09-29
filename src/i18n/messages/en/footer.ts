/**
 * @file en/footer.ts
 * @description 英文 - 页脚版权与标语文案，与 zh/footer.ts 逐 key 对应
 */
import type { Messages } from "../zh/footer";

const footer: Messages = {
  /**
   * 页脚版权行，含两个占位符：{site} 为站点名、{author} 为维护者名，
   * 年份为硬编码，跨年时需人工更新
   */
  copyright: "© 2026 {site} · Maintained by {author}",
  /** 页脚品牌标语，与 meta.siteDescription 的调性保持一致 */
  tagline: "Engineering notes · Deep thinking",
};

export default footer;
