import nav from "./nav";
import common from "./common";
import footer from "./footer";
import meta from "./meta";
import home from "./home";
import postList from "./post-list";
import postDetail from "./post-detail";
import auth from "./auth";
import profile from "./profile";
import settings from "./settings";
import write from "./write";
import errors from "./errors";
import feedback from "./feedback";

export const texts = {
  nav,

  common,

  footer,

  meta,

  home,

  postList,

  postDetail,

  auth,

  profile,

  settings,

  write,

  errors,

  feedback,
};

type TemplateParams = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

export function formatTemplate(template: string, params?: TemplateParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
