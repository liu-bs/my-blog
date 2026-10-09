/**
 * @file layout.tsx
 * @description 认证路由组 (auth) 布局，覆盖 /login、/register 页面。
 * 用 AuthGuard 包裹：已登录用户会被自动重定向离开（stale=1 时先清理本地登录态）；
 * 对外声明 robots 禁止索引，避免登录/注册页被搜索引擎收录。
 */
import { AuthGuard } from "@/components/auth/AuthGuard";

/** 认证页统一禁止搜索引擎索引与跟踪 */
export const metadata = { robots: { index: false, follow: false } };

/**
 * 认证页布局
 * @param props.children 具体认证页面内容（登录表单 / 注册表单）
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {/* 背景光晕装饰元素，纯视觉、对辅助技术隐藏 */}
      <div className="auth-halo" aria-hidden="true" />
      {/* 认证页主体内容容器 */}
      <div className="auth-main">{children}</div>
    </AuthGuard>
  );
}
