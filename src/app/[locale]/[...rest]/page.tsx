/**
 * @file [locale]/[...rest]/page.tsx
 * @description 语言分段下的 catch-all 兜底页，把该段内所有未匹配的深层路径收敛到 404，避免落入 global-not-found
 */
import { notFound } from "next/navigation";

/**
 * 将该路由标记为阻塞路由（退出 Instant Navigation）
 * @description 本页只调用 notFound()，不存在可用的静态壳；显式置为 false 避免被当作静态壳预渲染后出现空白页
 */
export const instant = false;

/**
 * LocaleCatchAll 未匹配路径兜底
 * @description 该分段下任何未被具体路由命中的路径都会落到这里，直接调用 notFound() 触发同分段的 not-found 页面（保留语言与站点外壳）
 */
export default function LocaleCatchAll() {
  notFound();
}
