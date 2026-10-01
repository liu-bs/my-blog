/**
 * @file page.tsx
 * @description 注册页：服务端生成页级元数据，表单交互由客户端 RegisterForm 组件承担
 *              （提交走 server action，成功后跳转登录页）
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import { RegisterForm } from "@/components/auth/RegisterForm";

/**
 * 生成注册页元数据
 * @param params 路由参数，含 locale
 * @returns 本地化的注册页标题与描述
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
    title: `${t("registerTitle")} · ${tMeta("siteTitle")}`,
    description: t("registerSubtitle"),
  };
}

/**
 * 注册页组件
 * @returns 注册表单
 */
export default function RegisterPage() {
  return <RegisterForm />;
}
