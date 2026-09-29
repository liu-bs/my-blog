/**
 * @file (auth)/layout.tsx
 * @description 认证路由组（(auth) 为 Next.js 分组目录，不产生 URL 段）的共享布局，服务于 /login 与 /register。
 * 职责：套一层客户端登录态守卫 AuthGuard，并统一登录页的居中容器与背景装饰；同时整组禁止搜索引擎索引。
 */
import { AuthGuard } from "@/components/auth/AuthGuard";

/** 登录/注册属于无索引价值的入口页，整组设为 noindex、nofollow */
export const metadata = { robots: { index: false, follow: false } };

/**
 * 认证分组布局
 * @description AuthGuard 在客户端判定登录态：已登录用户会被重定向离开（默认回首页，可用 redirect 查询参数指定目标），
 * 未登录时才渲染 children；`?stale=1` 时则先清空本地缓存的登录态再处理。守卫逻辑全在客户端，故此处不产出服务端跳转。
 * @param children 分组内的页面（登录页 / 注册页）
 * @returns 带背景装饰与语义化 main 容器的认证布局
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {/* 纯装饰性光晕背景，对辅助技术隐藏 */}
      <div className="auth-halo" aria-hidden="true" />
      <main className="auth-main">{children}</main>
    </AuthGuard>
  );
}
