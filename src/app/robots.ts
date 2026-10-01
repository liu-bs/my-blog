/**
 * @file robots.ts
 * @description 站点 robots.txt 生成路由（/robots.txt）：全站允许抓取，
 *              禁止收录登录/注册/写作/设置/个人中心等受保护页与 /api 接口，并声明 sitemap 地址
 */
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

/**
 * 生成 robots 规则
 * @returns 爬虫规则（允许全站、禁抓受保护路径与 /api）及 sitemap 指向
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
