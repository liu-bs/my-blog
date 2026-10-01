/**
 * @file layout.tsx
 * @description 受保护路由组（write/settings/profile）布局：AuthGate 客户端校验登录态，
 *              未登录跳转登录页；服务端拦截另由 src/proxy.ts 无 token 重定向兜底。
 *              instant=false 关闭即时导航以配合认证拦截；整组对搜索引擎 noindex
 */
import { AuthGate } from "@/components/auth/AuthGate";

/** 关闭即时导航，进入受保护页面前先完成认证拦截 */
export const instant = false;

/** 禁止搜索引擎收录受保护页面 */
export const metadata = { robots: { index: false, follow: false } };

/**
 * 控制台布局组件
 * @param children 子路由内容（写作/设置/个人中心页面）
 * @returns 包裹 AuthGate 的子路由内容
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
