/**
 * @file page.tsx
 * @description locale 段捕获所有未匹配路由（catch-all），统一渲染 404；
 *              instant=false 表示路由切换时不做即时预取跳转，走完整渲染流程
 */
import { notFound } from "next/navigation";

/** 关闭即时导航，未匹配路由始终走 404 渲染 */
export const instant = false;

/**
 * 兜底 404 页面
 * @returns 无渲染内容，直接触发 not-found 边界
 */
export default function LocaleCatchAll() {
  notFound();
}
