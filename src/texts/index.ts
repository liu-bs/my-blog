/**
 * @file index.ts
 * @description 全站文案入口：聚合各页面文案模块为 messages 字典，并提供 formatTemplate 占位符插值函数。
 * 消费方覆盖几乎所有客户端组件，以及 src/lib/toast.ts、src/lib/message.ts、src/lib/apiRequest.ts；
 * 统一以 `import { messages, formatTemplate } from "@/texts"` 引入。
 */

import nav from "./nav";
import common from "./common";
import footer from "./footer";
import meta from "./meta";
import home from "./home";
import posts from "./posts";
import post from "./post";
import auth from "./auth";
import profile from "./profile";
import settings from "./settings";
import write from "./write";
import errors from "./errors";
import feedback from "./feedback";

/** 按模块聚合的全站文案字典 */
export const messages = {
  /** 顶部导航与账户菜单文案 */
  nav,
  /** 通用控件文案 */
  common,
  /** 页脚文案 */
  footer,
  /** 站点元信息文案 */
  meta,
  /** 首页文案 */
  home,
  /** 文章列表页文案 */
  posts,
  /** 文章详情页与评论文案 */
  post,
  /** 登录/注册页文案 */
  auth,
  /** 个人中心页文案 */
  profile,
  /** 账号设置页文案 */
  settings,
  /** 写作页文案 */
  write,
  /** 错误页文案 */
  errors,
  /** 操作反馈文案 */
  feedback,
};

/** 文案模板插值参数表，键对应模板中的 {key} 占位符 */
type MessageParams = Record<string, string | number>;

/** 匹配模板中 {key} 形式的占位符 */
const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * 将文案模板中的 {key} 占位符替换为实际值
 * @param template 含占位符的文案模板，如 "共 {count} 篇"
 * @param params 插值参数；缺省时原样返回模板
 * @returns 插值后的文案字符串；params 中不存在的占位符保持原样
 * @example
 * formatTemplate("已新增{entity}", { entity: "文章" }) // "已新增文章"
 */
export function formatTemplate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
