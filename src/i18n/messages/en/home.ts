/**
 * @file home.ts
 * @description 英文文案 - 首页：主视觉区（hero）、最新文章列表及加载失败提示
 */
import type { Messages } from "../zh/home";

/**
 * 首页文案集合
 */
const home: Messages = {
  heroSection: "Hero",

  heroBadge: "Technical writing · Engineering notes",

  codeComment: "// authGuard: verify cookie + inject user",

  heroKicker: "Devoted makers",
  heroTitle: "Deep notes on engineering",
  heroLead: "Engineering thoughts worth revisiting.",

  browsePosts: "Browse posts",

  startWriting: "Start writing",

  latestSection: "Latest posts",

  latestTitle: "Latest posts",
  latestSubtitle: "Latest engineering thoughts & practice",
  viewAll: "View all",

  viewAllCount: "View all {count} posts",

  loadErrorTitle: "Failed to load posts",

  loadErrorDesc: "Network error or the service is down. Refresh and try again.",
};

export default home;
