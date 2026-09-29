/**
 * @file (dashboard)/layout.tsx
 * @description 控制台路由组（(dashboard) 为 Next.js 分组目录，不产生 URL 段）的共享布局，
 * 服务于 /profile、/settings、/write。职责：用客户端组件 AuthGate 做统一登录态门禁，并对整组禁用搜索引擎索引。
 * 注意这里只是「客户端可见性」层面的守卫；页面本身还会在服务端调用 requireUserOrRedirect 做真正的会话校验与跳转。
 */
import { AuthGate } from "@/components/auth/AuthGate";

/** 段配置：关闭本分段的即时导航（instant navigation）优化与校验；受保护内容依赖运行时登录态，不适用静态假设 */
export const instant = false;

/** 控制台页面均为个人页面，整组设为 noindex、nofollow */
export const metadata = { robots: { index: false, follow: false } };

/**
 * 控制台分组布局
 * @description 由 AuthGate 在客户端判定登录态并三态渲染：读取登录态期间展示 DashboardSkeleton；
 * 未登录展示 LoginRequired 提示（不发跳转）；已登录才渲染 children。
 * 后端会二次校验（各页面内的 requireUserOrRedirect），因此该门禁只负责首屏体验与信息隐藏，不是唯一防线。
 * @param children 分组内的页面（资料 / 设置 / 写作）
 * @returns 经登录门禁包裹的页面内容
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
