/**
 * @file zh/nav.ts
 * @description 中文 - 全站导航与顶栏文案（导航项、用户菜单、主题与语言切换、无障碍标签）
 */
const nav = {
  /** 站点品牌名，展示在顶栏 Logo 处，需与 meta.siteTitle 保持一致 */
  brand: "工程笔记",
  home: "主页",
  posts: "文章",
  login: "登录",
  register: "注册",
  /** 用户菜单按钮的无障碍标签（不是菜单项文案） */
  userMenu: "账户",
  /** 用户菜单里指向个人主页的入口 */
  profile: "资料",
  write: "写作",
  settings: "设置",
  /** 用户菜单里的登出操作 */
  logout: "退出",
  /** 移动端菜单按钮的 aria-label，随菜单开合在 openMenu / closeMenu 间切换 */
  openMenu: "打开菜单",
  closeMenu: "关闭菜单",
  /** 主题选项分组标题 */
  theme: "主题",
  themeLight: "亮色",
  themeDark: "暗色",
  /** 语言选项分组标题 */
  language: "语言",
  /** 主题切换按钮的 aria-label，与上面的分组标题 theme 区分 */
  themeToggle: "切换主题",
  /** 语言切换按钮的 aria-label，与上面的分组标题 language 区分 */
  languageToggle: "切换语言",
  /** 跳转到主内容的无障碍链接文案，键盘 Tab 首个焦点可见 */
  skipToContent: "跳到主要内容",
  /** 头像 img 的 alt 文本，{name} 为用户名占位符 */
  avatarAlt: "{name}的头像",
};

export type Messages = typeof nav;
export default nav;
