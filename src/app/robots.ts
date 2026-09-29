/**
 * @file robots.ts
 * @description 生成 /robots.txt：声明站点地图地址，并禁止爬虫抓取需登录的私有页面与 API
 */
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

/**
 * 生成 robots 规则
 * @returns 允许抓取全站，但屏蔽登录 / 注册 / 写作 / 设置 / 个人主页及 /api；多语言路由用一段通配前缀覆盖 zh、en 两种语言
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_URL;
  return {
    rules: {
      userAgent: "*",

      allow: "/",

      disallow: ["/*/login", "/*/register", "/*/write", "/*/settings", "/*/profile", "/api"],
    },

    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
