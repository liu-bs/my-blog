/**
 * @file manifest.ts
 * @description PWA Web App Manifest 路由（GET /manifest.webmanifest），由 Next.js 静态生成。
 * 定义应用名称、启动 URL、显示模式、主题色与应用图标，供移动端"添加到主屏幕"使用。
 */
import type { MetadataRoute } from "next";
import { messages } from "@/texts";

/**
 * 生成 PWA manifest
 * @returns Manifest 配置对象（名称、图标、主题色等取自全局文案 messages.meta）
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.meta.siteTitle,
    short_name: messages.meta.siteTitle,
    description: messages.meta.siteDescription,

    id: "/",
    start_url: "/",
    scope: "/",

    display: "standalone",

    background_color: "#fafafa",
    theme_color: "#09090b",

    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
