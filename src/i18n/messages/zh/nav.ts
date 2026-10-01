/**
 * @file nav.ts
 * @description 中文文案 - 顶部导航栏：品牌名、主导航链接、用户菜单、主题/语言切换及无障碍标签
 */
/**
 * 导航栏文案集合
 */
const nav = {
  brand: "工程笔记",
  home: "主页",
  posts: "文章",
  login: "登录",
  register: "注册",

  userMenu: "账户",

  profile: "资料",
  write: "写作",
  settings: "设置",

  logout: "退出",

  openMenu: "打开菜单",
  closeMenu: "关闭菜单",

  theme: "主题",
  themeLight: "亮色",
  themeDark: "暗色",

  language: "语言",

  themeToggle: "切换主题",

  languageToggle: "切换语言",

  skipToContent: "跳到主要内容",

  avatarAlt: "{name}的头像",
};

export type Messages = typeof nav;
export default nav;
