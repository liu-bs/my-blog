/**
 * @file en/home.ts
 * @description 英文 - 首页文案（主视觉区、最新文章区块、加载失败态），与 zh/home.ts 逐 key 对应
 */
import type { Messages } from "../zh/home";

const home: Messages = {
  /** 主视觉 <section> 的 aria-label */
  heroSection: "Hero",
  /** 主视觉上方的小标签 */
  heroBadge: "Technical writing · Engineering notes",
  /** 主视觉里展示的代码示例文本，含行注释前缀 "//"，是展示内容而非代码注释，勿删 */
  codeComment: "// authGuard: verify cookie + inject user",
  /** 主视觉副标题上方的小字 */
  heroKicker: "Devoted makers",
  heroTitle: "Deep notes on engineering",
  heroLead: "Engineering thoughts worth revisiting.",
  /** 主视觉按钮，跳转文章列表 */
  browsePosts: "Browse posts",
  /** 主视觉按钮，跳转写作页 */
  startWriting: "Start writing",
  /** 最新文章区块的 aria-label */
  latestSection: "Latest posts",
  /** 最新文章区块的可见标题 */
  latestTitle: "Latest posts",
  latestSubtitle: "Latest engineering thoughts & practice",
  viewAll: "View all",
  /** 查看全部入口的 count 为文章总数占位符 */
  viewAllCount: "View all {count} posts",
  /** 文章列表加载失败时的标题 */
  loadErrorTitle: "Failed to load posts",
  /** 加载失败的说明文案 */
  loadErrorDesc: "Network error or the service is down. Refresh and try again.",
};

export default home;
