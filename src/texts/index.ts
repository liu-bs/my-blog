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

export const messages = {

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

type MessageParams = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

export function formatTemplate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
