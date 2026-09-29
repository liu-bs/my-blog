/**
 * @file (auth)/login/page.tsx
 * @description 登录页（Server Component 外壳）。服务端只负责生成 SEO 元信息，真正的表单交互全部交给客户端组件 LoginForm；
 * 页面本身不读取数据、不做登录态判定（守卫由 (auth)/layout.tsx 的 AuthGuard 承担）。
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import { LoginForm } from "@/components/auth/LoginForm";

/**
 * 生成登录页 SEO 元信息
 * @description 标题由 i18n 的 auth.loginTitle 与站点名拼接，描述取登录页副标题
 * @param params 动态路由参数，含 locale
 * @returns Next.js Metadata
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);

  // auth / meta 两个命名空间并行取翻译
  const [t, tMeta] = await Promise.all([getTranslations("auth"), getTranslations("meta")]);
  return {
    title: `${t("loginTitle")} · ${tMeta("siteTitle")}`,
    description: t("loginSubtitle"),
  };
}

/**
 * 登录页
 * @description 无服务端数据依赖，直接把渲染委托给客户端 LoginForm（内部处理表单状态与提交）
 * @returns 登录表单组件
 */
export default function LoginPage() {
  return <LoginForm />;
}
