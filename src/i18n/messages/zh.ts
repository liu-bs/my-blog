/**
 * @file zh.ts
 * @description 中文语言包聚合入口：把 zh/ 下的各业务子模块按模块名拼成一个命名空间对象，
 * 命名空间名即 next-intl 中 t('<namespace>') 的取值（如 t('post')）。
 * Messages 类型也由本文件导出，作为全站语言包结构的唯一基准，供英文包做同构校验。
 * 新增业务模块时需同步三处：新建 zh/<module>.ts 与 en/<module>.ts、在此处 import 并加入对象、en.ts 同步加入
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

/** 中文聚合语言包，键为命名空间名、值为对应子模块文案 */
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

/** 语言包结构类型（以中文包为基准），英文包用同名类型约束自身保持同构 */
export type Messages = typeof zh;

export default zh;
