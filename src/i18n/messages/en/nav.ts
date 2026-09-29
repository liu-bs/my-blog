/**
 * @file en/nav.ts
 * @description 英文 - 全站导航与顶栏文案（导航项、用户菜单、主题与语言切换、无障碍标签），与 zh/nav.ts 逐 key 对应
 */
import type { Messages } from "../zh/nav";

const nav: Messages = {
  /** 站点品牌名，展示在顶栏 Logo 处，需与 meta.siteTitle 保持一致 */
  brand: "Engineering Notes",
  home: "Home",
  posts: "Posts",
  login: "Sign in",
  register: "Sign up",
  /** 用户菜单按钮的无障碍标签（不是菜单项文案） */
  userMenu: "Account",
  /** 用户菜单里指向个人主页的入口 */
  profile: "Profile",
  write: "Write",
  settings: "Settings",
  /** 用户菜单里的登出操作 */
  logout: "Sign out",
  /** 移动端菜单按钮的 aria-label，随菜单开合在 openMenu / closeMenu 间切换 */
  openMenu: "Open menu",
  closeMenu: "Close menu",
  /** 主题选项分组标题 */
  theme: "Theme",
  themeLight: "Light",
  themeDark: "Dark",
  /** 语言选项分组标题 */
  language: "Language",
  /** 主题切换按钮的 aria-label，与上面的分组标题 theme 区分 */
  themeToggle: "Toggle theme",
  /** 语言切换按钮的 aria-label，与上面的分组标题 language 区分 */
  languageToggle: "Switch language",
  /** 跳转到主内容的无障碍链接文案，键盘 Tab 首个焦点可见 */
  skipToContent: "Skip to main content",
  /** 头像 img 的 alt 文本，{name} 为用户名占位符 */
  avatarAlt: "{name}'s avatar",
};

export default nav;
