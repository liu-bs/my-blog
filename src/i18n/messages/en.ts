/**
 * @file en.ts
 * @description 英文语言包聚合入口：按与 zh 包完全相同的模块结构聚合英文文案，
 *              整体标注为 Messages 类型，与中文包保持键同构，缺失或多余的键会在编译期报错
 */
import type { Messages } from "./zh";
import nav from "./en/nav";
import common from "./en/common";
import footer from "./en/footer";
import meta from "./en/meta";
import home from "./en/home";
import posts from "./en/posts";
import post from "./en/post";
import auth from "./en/auth";
import profile from "./en/profile";
import settings from "./en/settings";
import write from "./en/write";
import errors from "./en/errors";
import feedback from "./en/feedback";

/**
 * 英文文案集合，结构与 zh 包严格同构
 */
const en: Messages = {
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

export default en;
