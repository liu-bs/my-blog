/**
 * @file seo.ts
 * @description Next.js Metadata 辅助工具：为页面生成统一的 alternates 配置（canonical 指向自身、RSS 指向 /rss）
 */
import type { Metadata } from "next";

/** Metadata.alternates 字段的类型别名 */
type PageAlternates = NonNullable<Metadata["alternates"]>;

/**
 * 生成页面级 alternates 配置
 * @param path 页面 canonical 路径（如 /posts/abc）
 * @returns 含 canonical 与 RSS types 的 alternates 对象，可直接赋给 Metadata.alternates
 * @example export const metadata = { alternates: pageAlternates("/posts") };
 */
export function pageAlternates(path: string): PageAlternates {
  return {
    canonical: path,
    types: { "application/rss+xml": "/rss" },
  };
}
