/**
 * @file page.tsx
 * @description 登录页（路由 /login），Server Component 壳：本身不拉数据，
 * 仅生成 metadata 并渲染客户端表单 LoginForm；鉴权由 (auth)/layout 的 AuthGuard 处理
 * （已登录则跳回 redirect 参数指定页面）。
 */
import type { Metadata } from "next";
import { messages } from "@/texts";
import { LoginForm } from "@/components/auth/LoginForm";

/**
 * 生成登录页 SEO metadata：标题为「登录 · 站点名」，描述取登录副标题
 */
export function generateMetadata(): Metadata {
  return {
    title: `${messages.auth.loginTitle} · ${messages.meta.siteTitle}`,
    description: messages.auth.loginSubtitle,
  };
}

/**
 * 登录页入口，渲染客户端登录表单
 */
export default function LoginPage() {
  return <LoginForm />;
}
