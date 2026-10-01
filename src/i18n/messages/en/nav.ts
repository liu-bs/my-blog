/**
 * @file nav.ts
 * @description 英文文案 - 顶部导航栏：品牌名、主导航链接、用户菜单、主题/语言切换及无障碍标签
 */
import type { Messages } from "../zh/nav";

/**
 * 导航栏文案集合
 */
const nav: Messages = {
  brand: "Engineering Notes",
  home: "Home",
  posts: "Posts",
  login: "Sign in",
  register: "Sign up",

  userMenu: "Account",

  profile: "Profile",
  write: "Write",
  settings: "Settings",

  logout: "Sign out",

  openMenu: "Open menu",
  closeMenu: "Close menu",

  theme: "Theme",
  themeLight: "Light",
  themeDark: "Dark",

  language: "Language",

  themeToggle: "Toggle theme",

  languageToggle: "Switch language",

  skipToContent: "Skip to main content",

  avatarAlt: "{name}'s avatar",
};

export default nav;
