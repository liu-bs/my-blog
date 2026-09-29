/**
 * @file en.ts
 * @description 英文语言包聚合入口：与 zh.ts 结构一一对应，把 en/ 下同名的各业务子模块拼成同名命名空间对象。
 * Messages 类型直接复用中文包的推导结果，因此任何 key 缺失、多写或拼写不一致都会在编译期报错
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

/** 英文聚合语言包，命名空间需与 zh.ts 完全一致 */
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
