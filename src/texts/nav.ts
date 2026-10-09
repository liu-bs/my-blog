/**
 * @file nav.ts
 * @description 顶部导航与账户菜单文案（Navbar、NavLinks、UserMenu、MobileMenu、ThemeToggle），
 * 经 messages.nav 消费。
 */

/** 导航相关文案集合 */
const nav = {
  /** 导航栏左侧品牌名 */
  brand: "慢半拍",
  /** 顶部导航主页链接 */
  home: "主页",
  /** 顶部导航文章列表链接 */
  posts: "文章",
  /** 未登录时导航栏的登录按钮 */
  login: "登录",
  /** 未登录时导航栏的注册按钮 */
  register: "注册",

  /** 账户下拉菜单触发器/容器的无障碍标签 */
  userMenu: "账户",

  /** 用户菜单：资料页入口 */
  profile: "资料",
  /** 用户菜单：写作页入口 */
  write: "写作",
  /** 用户菜单：设置页入口 */
  settings: "设置",

  /** 用户菜单：退出登录项 */
  logout: "退出",

  /** 移动端菜单展开按钮的无障碍标签 */
  openMenu: "打开菜单",
  /** 移动端菜单收起按钮的无障碍标签 */
  closeMenu: "关闭菜单",

  /** 主题菜单分组标签 */
  theme: "主题",
  /** 主题选项：亮色 */
  themeLight: "亮色",
  /** 主题选项：暗色 */
  themeDark: "暗色",

  /** ThemeToggle 切换按钮的无障碍标签 */
  themeToggle: "切换主题",

  /** 页面顶部对读屏用户隐藏的跳到主内容链接 */
  skipToContent: "跳到主要内容",

  /** 头像图片替代文本，{name} 为用户显示名（formatTemplate 插值） */
  avatarAlt: "{name}的头像",
};

/** 导航文案默认导出 */
export default nav;
