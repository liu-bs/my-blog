/**
 * @file robots.ts
 * @description robots.txt 路由（GET /robots.txt），由 Next.js 静态生成。
 * 允许爬取全站公开内容，屏蔽登录/注册/写作/设置/个人中心及 API 路由，并声明 sitemap 地址。
 */
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

/**
 * 生成 robots.txt 规则
 * @returns Robots 配置对象（allow/disallow 规则 + sitemap 绝对地址）
 * @warning sitemap 地址基于 SITE_URL 拼接，SITE_URL 取自 NEXT_PUBLIC_BASE_URL 环境变量
 * （本项目本地配置在根目录 .env.local 中，已在仓库外验证存在且已设置）；
 * 若部署平台未注入该变量会回退为 localhost，导致搜索引擎抓到错误域名。
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_URL;
  return {
    rules: {
      // 对所有爬虫生效
      userAgent: "*",

      // 允许爬取全部公开页面
      allow: "/",

      // 屏蔽需登录的功能页与后端 API
      disallow: ["/login", "/register", "/write", "/settings", "/profile", "/api"],
    },

    // 指向 sitemap 路由生成的 XML
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
