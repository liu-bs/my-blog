/**
 * @file page.tsx
 * @description 注册页（路由 /register），Server Component 壳：仅生成 metadata
 * 并渲染客户端表单 RegisterForm；鉴权由 (auth)/layout 的 AuthGuard 统一处理。
 */
import type { Metadata } from "next";
import { messages } from "@/texts";
import { RegisterForm } from "@/components/auth/RegisterForm";

/**
 * 生成注册页 SEO metadata：标题为「注册 · 站点名」，描述取注册副标题
 */
export function generateMetadata(): Metadata {
  return {
    title: `${messages.auth.registerTitle} · ${messages.meta.siteTitle}`,
    description: messages.auth.registerSubtitle,
  };
}

/**
 * 注册页入口，渲染客户端注册表单
 */
export default function RegisterPage() {
  return <RegisterForm />;
}
