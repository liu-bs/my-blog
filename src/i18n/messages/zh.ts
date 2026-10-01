/**
 * @file zh.ts
 * @description 中文语言包聚合入口：按页面/场景分组聚合全部中文文案模块并作为默认导出，
 *              其导出类型 Messages 同时作为 en 包的类型约束与 next-intl 全局 Messages 类型基准
 */
import nav from "./zh/nav";
import common from "./zh/common";
import footer from "./zh/footer";
import meta from "./zh/meta";
import home from "./zh/home";
import posts from "./zh/posts";
import post from "./zh/post";
import auth from "./zh/auth";
import profile from "./zh/profile";
import settings from "./zh/settings";
import write from "./zh/write";
import errors from "./zh/errors";
import feedback from "./zh/feedback";

/**
 * 中文文案集合，按模块（页面/场景）命名空间分组
 */
const zh = {
  nav,
  common,
  footer,
  meta,
  home,
  posts,
  post,
  auth,
  profile,
  settings,
  write,
  errors,
  feedback,
};

export type Messages = typeof zh;

export default zh;
