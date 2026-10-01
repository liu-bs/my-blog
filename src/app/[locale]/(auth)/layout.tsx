/**
 * @file layout.tsx
 * @description 认证路由组（login/register）布局：AuthGuard 客户端守卫，
 *              已登录用户访问认证页时自动跳转首页；整组对搜索引擎 noindex
 */
import { AuthGuard } from "@/components/auth/AuthGuard";

/** 禁止搜索引擎收录登录/注册页 */
export const metadata = { robots: { index: false, follow: false } };

/**
 * 认证布局组件
 * @param children 子路由内容（登录/注册表单页）
 * @returns 包裹 AuthGuard 的认证页内容，含背景光晕装饰
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="auth-halo" aria-hidden="true" />
      <main className="auth-main">{children}</main>
    </AuthGuard>
  );
}
