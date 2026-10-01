/**
 * @file page.tsx
 * @description 登录页：服务端生成页级元数据，表单交互由客户端 LoginForm 组件承担
 *              （提交走 server action，成功后跳转 redirect 参数）
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import { LoginForm } from "@/components/auth/LoginForm";

/**
 * 生成登录页元数据
 * @param params 路由参数，含 locale
 * @returns 本地化的登录页标题与描述
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);

  const [t, tMeta] = await Promise.all([getTranslations("auth"), getTranslations("meta")]);
  return {
    title: `${t("loginTitle")} · ${tMeta("siteTitle")}`,
    description: t("loginSubtitle"),
  };
}

/**
 * 登录页组件
 * @returns 登录表单
 */
export default function LoginPage() {
  return <LoginForm />;
}
